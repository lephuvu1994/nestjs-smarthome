import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/common/database/services/database.service';
import { CreateDeviceModelDto } from './dtos/request/create-model.dto';
import { CreatePartnerDto } from './dtos/request/create-partner.dto';
import { PartnerUsageResponseDto } from './dtos/response/partner-usage.response.dto';
import { UpdatePartnerDto } from './dtos/request/update-partner-full.dto';
import { SetMqttConfigDto } from './dtos/request/set-mqtt-config.dto';

@Injectable()
export class AdminService {
    constructor(private readonly databaseService: DatabaseService) {}

    // 1. Tạo Công Ty (Partner)
    async createPartner(data: CreatePartnerDto) {
        const exists = await this.databaseService.partner.findUnique({
            where: { code: data.code },
        });
        if (exists) {
            throw new HttpException(
                'Partner Code already exists',
                HttpStatus.CONFLICT
            );
        }

        return this.databaseService.partner.create({
            data: {
                code: data.code,
                name: data.name,
                isActive: true,
            },
        });
    }

    // 2. Tạo Model Thiết Bị (DeviceModel)
    async createDeviceModel(data: CreateDeviceModelDto) {
        const exists = await this.databaseService.deviceModel.findUnique({
            where: { code: data.code },
        });
        if (exists) {
            throw new HttpException(
                'Device Model Code already exists',
                HttpStatus.CONFLICT
            );
        }

        return this.databaseService.deviceModel.create({
            data: {
                code: data.code,
                name: data.name,
                description: data.description,
            },
        });
    }

    // 4. Lấy danh sách Quota (Để xem tình trạng)
    async getAllQuotas() {
        return this.databaseService.licenseQuota.findMany({
            include: {
                partner: { select: { code: true, name: true } },
                deviceModel: { select: { code: true, name: true } },
            },
            orderBy: { partner: { code: 'asc' } },
        });
    }

    // [NEW] Lấy thống kê sử dụng
    async getPartnersUsage(): Promise<PartnerUsageResponseDto[]> {
        // 1. Query DB: Lấy Partner kèm theo Quota và DeviceModel
        const partners = await this.databaseService.partner.findMany({
            orderBy: { created_at: 'desc' },
            select: {
                code: true,
                name: true,
                quotas: {
                    select: {
                        activatedCount: true, // Số lượng đã dùng
                        maxQuantity: true, // Tổng cấp phép
                        deviceModel: {
                            select: {
                                code: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        // 2. Map dữ liệu sang DTO cho gọn gàng
        return partners.map(partner => ({
            companyCode: partner.code,
            companyName: partner.name,
            quotas: partner.quotas.map(quota => ({
                modelCode: quota.deviceModel.code,
                modelName: quota.deviceModel.name,
                used: quota.activatedCount,
                total: quota.maxQuantity,
            })),
        }));
    }

    // Lấy danh sách partner
    async getPartnersForDropdown() {
        return this.databaseService.partner.findMany({
            select: {
                code: true,
                name: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    // [NEW] 1. Lấy danh sách Model để đổ vào Dropdown (Select)
    async getDeviceModelsForDropdown() {
        return this.databaseService.deviceModel.findMany({
            select: {
                code: true, // Value của Option
                name: true, // Label của Option
            },
            orderBy: { name: 'asc' },
        });
    }

    // Thay thế cho cả updatePartnerName cũ và setQuota cũ
    async updatePartner(partnerCode: string, data: UpdatePartnerDto) {
        // 1. Check Partner tồn tại
        const existingPartner = await this.databaseService.partner.findUnique({
            where: { code: partnerCode },
        });

        if (!existingPartner) {
            throw new HttpException('Partner not found', HttpStatus.NOT_FOUND);
        }

        return this.databaseService.$transaction(async prisma => {
            // A. Cập nhật tên (Chỉ chạy nếu có gửi name lên)
            if (data.name) {
                await prisma.partner.update({
                    where: { code: partnerCode },
                    data: { name: data.name },
                });
            }

            // B. Cập nhật Quota (Chỉ chạy nếu có gửi quotas lên)
            if (data.quotas && data.quotas.length > 0) {
                const quotaPromises = data.quotas.map(async item => {
                    const model = await prisma.deviceModel.findUnique({
                        where: { code: item.deviceModelCode },
                    });

                    if (!model) {
                        // Có thể throw lỗi hoặc bỏ qua tuỳ logic, ở đây mình throw
                        throw new HttpException(
                            `Device Model Code '${item.deviceModelCode}' not found`,
                            HttpStatus.BAD_REQUEST
                        );
                    }

                    return prisma.licenseQuota.upsert({
                        where: {
                            partnerId_deviceModelId: {
                                partnerId: existingPartner.id,
                                deviceModelId: model.id,
                            },
                        },
                        update: { maxQuantity: item.quantity },
                        create: {
                            partnerId: existingPartner.id,
                            deviceModelId: model.id,
                            maxQuantity: item.quantity,
                            activatedCount: 0,
                            isActive: true,
                        },
                    });
                });

                await Promise.all(quotaPromises);
            }

            // Trả về data mới nhất sau khi update
            return this.getPartnerDetails(partnerCode); // (Hàm này bạn tự viết hoặc return existingPartner)
        });
    }

    // Helper function để trả về data đẹp sau khi update
    private async getPartnerDetails(code: string) {
        return this.databaseService.partner.findUnique({
            where: { code },
            include: { quotas: true },
        });
    }

    /**
     * Gộp 3 config MQTT vào một lần xử lý
     */
    async setMqttConfig(data: SetMqttConfigDto) {
        const configs = [
            { key: 'MQTT_HOST', value: data.host, desc: 'MQTT Broker Host' },
            {
                key: 'MQTT_USER',
                value: data.user,
                desc: 'MQTT Broker Username',
            },
            {
                key: 'MQTT_PASS',
                value: data.pass,
                desc: 'MQTT Broker Password',
            },
        ];

        // Chạy upsert cho cả 3 key cùng lúc
        await Promise.all(
            configs.map(config =>
                this.databaseService.systemConfig.upsert({
                    where: { key: config.key },
                    update: { value: config.value },
                    create: {
                        key: config.key,
                        value: config.value,
                        description: config.desc,
                    },
                })
            )
        );

        return { message: 'MQTT Configuration updated successfully' };
    }
}
