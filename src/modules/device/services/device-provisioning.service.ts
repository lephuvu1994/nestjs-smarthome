import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/common/database/services/database.service';
import { RedisService } from 'src/common/redis/services/redis.service';
import { RegisterDeviceDto } from '../dto/register-device.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DeviceProvisioningService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly redisService: RedisService
    ) {}

    async registerAndClaim(userId: string, dto: RegisterDeviceDto) {
        if (!userId) throw new BadRequestException('User không hợp lệ');

        const model = await this.databaseService.deviceModel.findUnique({
            where: { code: dto.deviceCode },
        });
        const partner = await this.databaseService.partner.findUnique({
            where: { id: dto.partner_id },
        });

        if (!model || !partner)
            throw new BadRequestException('Model hoặc Partner không hợp lệ');

        return await this.databaseService.$transaction(async tx => {
            const newDeviceToken = uuidv4();

            // A. XỬ LÝ HARDWARE
            let hardware = await tx.hardwareRegistry.findUnique({
                where: { identifier: dto.identifier },
            });

            if (hardware) {
                const oldDevice = await tx.device.findUnique({
                    where: { hardware_id: hardware.id },
                });
                if (oldDevice) {
                    await tx.device.delete({ where: { id: oldDevice.id } });
                    await this.redisService.del(`status:${oldDevice.token}`);
                    await this.redisService.del(`shadow:${oldDevice.token}`);
                }
                hardware = await tx.hardwareRegistry.update({
                    where: { id: hardware.id },
                    data: {
                        deviceToken: newDeviceToken,
                        activatedAt: new Date(),
                        partner_id: partner.id,
                        device_model_id: model.id,
                    },
                });
            } else {
                hardware = await tx.hardwareRegistry.create({
                    data: {
                        identifier: dto.identifier,
                        deviceToken: newDeviceToken,
                        partner_id: partner.id,
                        device_model_id: model.id,
                        mqttBroker: process.env.MQTT_HOST_PUBLIC,
                    },
                });
            }

            // B. CHUẨN BỊ FEATURES (Lấy từ Blueprint của Model)
            const config = model.featuresConfig as any;
            const featuresToCreate = (config.features || []).map(f => ({
                code: f.code,
                name: f.name,
                type: f.type,
                read_only: f.read_only || false,
                last_value: '0',
            }));

            // C. TẠO DEVICE INSTANCE
            const newDevice = await tx.device.create({
                data: {
                    name: dto.name,
                    token: newDeviceToken,
                    identifier: dto.identifier,
                    protocol: dto.protocol,
                    partner: { connect: { id: partner.id } },
                    deviceModel: { connect: { id: model.id } },
                    hardware: { connect: { id: hardware.id } },
                    owner: { connect: { id: userId } },
                    home: dto.homeId
                        ? { connect: { id: dto.homeId } }
                        : undefined,
                    room: dto.roomId
                        ? { connect: { id: dto.roomId } }
                        : undefined,
                    features: { create: featuresToCreate },
                },
                include: { features: true },
            });

            return {
                device: newDevice,
                mqttConfig: {
                    broker: hardware.mqttBroker,
                    port: parseInt(process.env.MQTT_PORT_PUBLIC || '1883'),
                    username: newDeviceToken,
                    password: newDeviceToken,
                    clientId: `device_${dto.identifier}`,
                    topicCommand: `${partner.code}/${newDeviceToken}/+/set`,
                    topicStatus: `${partner.code}/${newDeviceToken}/status`,
                    topicState: `${partner.code}/${newDeviceToken}/+/state`,
                },
            };
        });
    }
}
