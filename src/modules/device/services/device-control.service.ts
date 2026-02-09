import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    Inject,
    BadRequestException,
} from '@nestjs/common';
import { RedisService } from 'src/common/redis/services/redis.service';
import { ClientProxy } from '@nestjs/microservices';
import { ControlFeatureDto } from '../dto/control-feature.dto';
import { DatabaseService } from 'src/common/database/services/database.service';

@Injectable()
export class DeviceControlService {
    constructor(
        private readonly redisService: RedisService,
        private readonly databaseService: DatabaseService,
        // Inject Client MQTT đã khai báo bên Module
        @Inject('MQTT_SERVICE') private readonly mqttClient: ClientProxy
    ) {}

    async controlDeviceFeature(userId: string, dto: ControlFeatureDto) {
        // 1. TÌM KIẾM THÔNG TIN (Lookup) & JOIN BẢNG
        // Phải join cả Device và Partner để lấy đủ thông tin tạo Topic
        const feature = await this.databaseService.deviceFeature.findUnique({
            where: { id: dto.featureId },
            include: {
                device: {
                    include: {
                        partner: true, // Cần lấy Partner Code
                    },
                },
            },
        });

        // 2. VALIDATE
        if (!feature) {
            throw new NotFoundException('Tính năng không tồn tại');
        }

        const device = feature.device;
        const partner = device.partner;

        // Security Check: Kiểm tra quyền sở hữu
        // ✅ SỬA: Dùng ownerId (camelCase) thay vì owner_id
        if (device.owner_id !== userId) {
            throw new ForbiddenException(
                'Bạn không có quyền điều khiển thiết bị này'
            );
        }

        // 3. LOGIC MẠNG (Check Online/Offline)
        const deviceToken = device.token;
        const status = await this.redisService.get(`status:${deviceToken}`);

        // Tùy logic dự án: Có cho phép điều khiển khi Offline không?
        // Nếu muốn queue lại lệnh thì bỏ qua check này.
        // Nếu muốn báo lỗi ngay thì uncomment dòng dưới:
        /*
        if (status !== 'online') {
             throw new BadRequestException('Thiết bị đang Offline, vui lòng thử lại sau');
        }
        */

        // 4. CẬP NHẬT REDIS SHADOW (Desired State)
        // Shadow Key: shadow:{token}
        const shadowKey = `shadow:${deviceToken}`;
        const featureCode = feature.code; // Ví dụ: 'switch_1'

        // Lưu trạng thái mong muốn vào Redis
        // Format: "desired:switch_1" = 1
        await this.redisService.hset(
            shadowKey,
            `desired:${featureCode}`,
            JSON.stringify(dto.value) // Nên stringify để thống nhất kiểu dữ liệu
        );

        // 5. BẮN LỆNH MQTT (Command)
        // Cấu trúc Topic chuẩn: {PARTNER_CODE}/{DEVICE_TOKEN}/set
        // Ví dụ: BKTECH_GLOBAL/abc-xyz-token/set
        const topic = `${partner.code}/${deviceToken}/set`;

        const payload = {
            [featureCode]: dto.value, // { "switch_1": 1 }
            timestamp: Date.now(),
            reqId: Math.random().toString(36).substring(7), // Tracking ID để debug
        };

        // Emit lệnh xuống Broker
        this.mqttClient.emit(topic, payload);

        // 6. TRẢ VỀ KẾT QUẢ
        return {
            success: true,
            status: 'sent',
            topic: topic,
            data: {
                feature: feature.name,
                value: dto.value,
            },
        };
    }
}
