import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from 'src/common/database/services/database.service';
import { RegisterDeviceDto, DeviceProvisioningResponseDto } from '../dtos/register-device.dto';

@Injectable()
export class ProvisioningService {
    constructor(private readonly databaseService: DatabaseService) {}

    public async registerFromChip(data: RegisterDeviceDto): Promise<DeviceProvisioningResponseDto> {
        const { mac, deviceCode, companyCode } = data;

        // 1. Validate Input: Tìm Partner và DeviceModel
        const partner = await this.databaseService.partner.findUnique({
            where: { code: companyCode },
        });
        const model = await this.databaseService.deviceModel.findUnique({
            where: { code: deviceCode },
        });

        if (!partner || !model) {
            throw new HttpException('Invalid Company Code or Device Model Code', HttpStatus.BAD_REQUEST);
        }

        // 2. Check xem MAC này đã tồn tại trong hệ thống chưa
        const existingHardware = await this.databaseService.hardwareRegistry.findUnique({
            where: { hmac: mac },
            include: { partner: true, deviceModel: true } // Join để check thông tin cũ
        });

        // 3. Xử lý Logic
        if (existingHardware) {
            // === CASE A: ĐÃ TỒN TẠI & THÔNG TIN KHỚP ===
            if (existingHardware.partner.code === companyCode &&
                existingHardware.deviceModel.code === deviceCode) {
                // Trả về thông tin cũ, không trừ quota
                return this.buildResponse(existingHardware);
            }

            // === CASE B: ĐÃ TỒN TẠI NHƯNG KHÁC THÔNG TIN (TRANSFER) ===
            // Ví dụ: Thiết bị được nạp lại Firmware của Công ty khác, hoặc Model khác
            return this.handleTransferDevice(existingHardware, partner, model);
        }

        // === CASE C: CHƯA TỒN TẠI (NEW REGISTRATION) ===
        return this.handleNewRegistration(mac, partner, model);
    }

    // --- LOGIC: ĐĂNG KÝ MỚI ---
    private async handleNewRegistration(mac: string, partner: any, model: any) {
        // Dùng Transaction để đảm bảo tính toàn vẹn (Check quota -> Trừ quota -> Tạo device)
        return this.databaseService.$transaction(async (prisma) => {
            // 1. Tìm Quota
            const quota = await prisma.licenseQuota.findUnique({
                where: {
                    partnerId_deviceModelId: {
                        partnerId: partner.id,
                        deviceModelId: model.id,
                    },
                },
            });

            // 2. Validate Quota
            if (!quota || !quota.isActive || quota.activatedCount >= quota.maxQuantity) {
                throw new HttpException(
                    `License Quota Exceeded for Partner: ${partner.code} - Model: ${model.code}`,
                    HttpStatus.FORBIDDEN
                );
            }

            // 3. Tăng số lượng đã kích hoạt
            await prisma.licenseQuota.update({
                where: { id: quota.id },
                data: { activatedCount: { increment: 1 } },
            });

            // 4. Tạo Hardware Registry
            const creds = this.generateCredentials(mac);
            const newHardware = await prisma.hardwareRegistry.create({
                data: {
                    hmac: mac,
                    partnerId: partner.id,
                    deviceModelId: model.id,
                    // Credentials
                    deviceToken: creds.token,
                    mqttUsername: creds.username,
                    mqttPassword: creds.password,
                    mqttBroker: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
                },
            });

            return this.buildResponse(newHardware);
        });
    }

    // --- LOGIC: CHUYỂN ĐỔI (TRANSFER) ---
    private async handleTransferDevice(existingHardware: any, newPartner: any, newModel: any) {
        return this.databaseService.$transaction(async (prisma) => {
            const oldPartnerId = existingHardware.partnerId;
            const oldModelId = existingHardware.deviceModelId;

            // 1. Check Quota của Partner MỚI
            const newQuota = await prisma.licenseQuota.findUnique({
                where: {
                    partnerId_deviceModelId: {
                        partnerId: newPartner.id,
                        deviceModelId: newModel.id,
                    },
                },
            });

            if (!newQuota || !newQuota.isActive || newQuota.activatedCount >= newQuota.maxQuantity) {
                throw new HttpException('New Partner Quota Exceeded', HttpStatus.FORBIDDEN);
            }

            // 2. Lấy Config Admin xem có hoàn trả Quota cho Partner CŨ không?
            const refundConfig = await prisma.systemConfig.findUnique({
                where: { key: 'REFUND_QUOTA_ON_TRANSFER' },
            });
            const shouldRefund = refundConfig?.value === 'true';

            // 3. Cập nhật Quota
            // A. Tăng quota bên mới
            await prisma.licenseQuota.update({
                where: { id: newQuota.id },
                data: { activatedCount: { increment: 1 } },
            });

            // B. Giảm quota bên cũ (Nếu config cho phép)
            if (shouldRefund) {
                const oldQuota = await prisma.licenseQuota.findUnique({
                    where: {
                        partnerId_deviceModelId: {
                            partnerId: oldPartnerId,
                            deviceModelId: oldModelId,
                        },
                    },
                });

                // Chỉ giảm nếu số lượng > 0
                if (oldQuota && oldQuota.activatedCount > 0) {
                    await prisma.licenseQuota.update({
                        where: { id: oldQuota.id },
                        data: { activatedCount: { decrement: 1 } },
                    });
                }
            }

            // 4. Cập nhật Hardware Registry
            // Tạo credentials mới để đảm bảo bảo mật (Partner cũ ko dùng được nữa)
            const newCreds = this.generateCredentials(existingHardware.hmac);

            const updatedHardware = await prisma.hardwareRegistry.update({
                where: { id: existingHardware.id },
                data: {
                    partnerId: newPartner.id,
                    deviceModelId: newModel.id,
                    // Cập nhật credentials mới
                    deviceToken: newCreds.token,
                    mqttUsername: newCreds.username,
                    mqttPassword: newCreds.password,
                    // Reset trạng thái ban đầu (tuỳ chọn)
                    isBanned: false,
                },
            });

            return this.buildResponse(updatedHardware);
        });
    }

    // --- HELPER FUNCTIONS ---

    private generateCredentials(mac: string) {
        // Tạo chuỗi ngẫu nhiên an toàn
        return {
            token: crypto.randomBytes(32).toString('hex'), // Token API 64 ký tự
            username: `device_${mac.replace(/[:]/g, '').toLowerCase()}`,
            password: crypto.randomBytes(16).toString('hex'), // Mật khẩu MQTT 32 ký tự
        };
    }

    private buildResponse(hardware: any): DeviceProvisioningResponseDto {
        return {
            deviceToken: hardware.deviceToken,
            mqttBroker: hardware.mqttBroker,
            mqttUsername: hardware.mqttUsername,
            mqttPassword: hardware.mqttPassword,
            mqttTopicSub: `cmd/${hardware.hmac}`,
            mqttTopicPub: `data/${hardware.hmac}`,
        };
    }
}
