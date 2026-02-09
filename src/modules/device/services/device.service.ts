// src/modules/device/services/device.service.ts
import {
    Injectable,
    HttpException,
    HttpStatus,
    BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum';
import { IDeviceCommand } from '../interfaces/device-control.interface';
import { RedisService } from 'src/common/redis/services/redis.service'; // Giả định bạn có service này
import { DatabaseService } from 'src/common/database/services/database.service';
import { v4 as uuidv4 } from 'uuid';
import { RegisterDeviceDto } from '../dto/register-device.dto';

@Injectable()
export class DeviceService {
    constructor(
        @InjectQueue(APP_BULLMQ_QUEUES.DEVICE_CONTROL)
        private deviceQueue: Queue,
        private readonly redisService: RedisService,
        private readonly databaseService: DatabaseService
    ) {}

    async registerAndClaim(userId: string, dto: RegisterDeviceDto) {
        // --- VALIDATE USER ---
        // Nếu user null hoặc không có id -> Báo lỗi ngay
        if (!userId || userId.length === 0) {
            throw new BadRequestException(
                `User không hợp lệ. Vui lòng đăng nhập lại. (Received: ${JSON.stringify(userId)})`
            );
        }
        // 1. Validate Model & Partner (Blueprint Check)
        const model = await this.databaseService.deviceModel.findUnique({
            where: { code: dto.deviceCode },
            include: { quotas: true }, // Check quota nếu cần
        });
        const partner = await this.databaseService.partner.findUnique({
            where: { id: dto.partner_id },
        });

        if (!model || !partner)
            throw new BadRequestException('Model hoặc Partner không hợp lệ');

        // 2. Transaction "Thần thánh": Xử lý Hardware -> Device -> Features
        return await this.databaseService.$transaction(async tx => {
            // --- BƯỚC A: XỬ LÝ HARDWARE REGISTRY ---
            // Tìm xem phần cứng này đã từng tồn tại chưa
            let hardware = await tx.hardwareRegistry.findUnique({
                where: { identifier: dto.identifier },
            });

            const newDeviceToken = uuidv4(); // Token mới cho lần đăng ký này

            if (hardware) {
                // [LOGIC RESET] Nếu hardware đã tồn tại -> Cưỡng chế chiếm quyền (Force Takeover)

                // 1. Xóa Device cũ (nếu đang thuộc về User khác)
                const oldDevice = await tx.device.findUnique({
                    where: { hardware_id: hardware.id },
                });

                if (oldDevice) {
                    // Xóa Device cũ
                    await tx.device.delete({ where: { id: oldDevice.id } });
                    // Xóa Auth cũ trong Redis
                    await this.redisService.del(
                        `auth:token:${oldDevice.token}`
                    );
                }

                // 2. Cập nhật Hardware với Token mới
                hardware = await tx.hardwareRegistry.update({
                    where: { id: hardware.id },
                    data: {
                        deviceToken: newDeviceToken,
                        activatedAt: new Date(),
                        // Cập nhật model/partner nếu có thay đổi (Flash lại FW)
                        device_model_id: model.id,
                        partner_id: partner.id,
                    },
                });
            } else {
                // [LOGIC NEW] Nếu chưa có -> Tạo Hardware mới (Trừ Quota ở đây nếu cần)
                hardware = await tx.hardwareRegistry.create({
                    data: {
                        identifier: dto.identifier,
                        deviceToken: newDeviceToken,
                        device_model_id: model.id,
                        partner_id: partner.id,
                        // Config mặc định lấy từ ENV hoặc DB SystemConfig
                        mqttBroker: process.env.MQTT_HOST_PUBLIC,
                    },
                });
            }

            // --- BƯỚC B: TẠO DEVICE (INSTANCE) CHO USER ---

            // Chuẩn bị Features từ JSON Blueprint
            const featuresConfig = model.featuresConfig as any[];
            const featuresToCreate = featuresConfig.map(f => ({
                code: f.code,
                name: f.name,
                category: f.category,
                type: f.type,
                min: f.min,
                max: f.max,
                unit: f.unit,
                read_only: f.read_only || false,
                last_value: 0,
            }));

            const newDevice = await tx.device.create({
                data: {
                    name: dto.name,
                    token: newDeviceToken,
                    identifier: dto.identifier,
                    protocol: dto.protocol,

                    // --- CÁC QUAN HỆ BẮT BUỘC (Dùng connect) ---
                    partner: { connect: { id: partner.id } },
                    deviceModel: { connect: { id: model.id } },
                    hardware: { connect: { id: hardware.id } },
                    owner: { connect: { id: userId } },

                    // --- CÁC QUAN HỆ KHÔNG BẮT BUỘC (OPTIONAL) ---
                    // ❌ LỖI CŨ: home_id: dto.homeId
                    // ✅ SỬA MỚI: Dùng relation 'home' + 'connect'
                    home: dto.homeId
                        ? { connect: { id: dto.homeId } }
                        : undefined,

                    // ❌ LỖI CŨ: room_id: dto.roomId
                    // ✅ SỬA MỚI: Dùng relation 'room' + 'connect'
                    room: dto.roomId
                        ? { connect: { id: dto.roomId } }
                        : undefined,

                    // --- TẠO FEATURES ---
                    features: {
                        create: featuresToCreate,
                    },
                },
                include: {
                    features: true,
                },
            });

            // --- BƯỚC D: TRẢ VỀ CONFIG CHO CHIP ---
            // Dữ liệu này App sẽ nhận được và bắn qua Bluetooth cho Chip
            const mqttConfig = {
                broker: hardware.mqttBroker,
                port: parseInt(process.env.MQTT_PORT_PUBLIC || '1883'),
                username: newDeviceToken, // Token là User
                password: newDeviceToken, // Token là Pass (hoặc logic riêng)
                clientId: `device_${dto.identifier}`,
                topicCommand: `${partner.code}/${newDeviceToken}/set`,
                topicStatus: `${partner.code}/${newDeviceToken}/status`,
            };

            return {
                device: newDevice, // Để App hiển thị UI ngay lập tức
                mqttConfig: mqttConfig, // Để App gửi xuống Chip
            };
        });
    }

    async publishControlCommand(
        token: string,
        category: string,
        type: string,
        value: any
    ) {
        // 1. Kiểm tra trạng thái Online từ Redis (Set bởi Worker MQTT ping/status)
        const isOnline = await this.redisService.get(`status:${token}`);

        if (!isOnline || isOnline !== 'online') {
            throw new HttpException(
                'Thiết bị đang offline. Không thể điều khiển lúc này.',
                HttpStatus.SERVICE_UNAVAILABLE
            );
        }

        // 2. Cập nhật Desired State vào Shadow Redis
        const shadowKey = `shadow:${token}`;
        await this.redisService.hset(
            shadowKey,
            `${category}:${type}:desired`,
            value
        );

        // 3. Đẩy Job vào BullMQ để Worker xử lý bắn MQTT
        const payload: IDeviceCommand = { token, category, type, value };

        await this.deviceQueue.add('send-mqtt', payload, {
            priority: 1, // Lệnh điều khiển luôn ưu tiên cao nhất
            removeOnComplete: true,
            attempts: 1, // Cửa cuốn không nên tự ý retry nhiều lần nếu lỗi logic
        });

        return {
            message: 'Lệnh điều khiển đã được gửi vào hàng đợi xử lý',
            status: 'pending',
            token,
        };
    }
}
