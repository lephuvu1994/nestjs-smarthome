// src/modules/device/processors/device-control.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum'; // ✅ Thêm DEVICE_JOBS
import { SocketGateway } from 'src/modules/socket/gateways/socket.gateway';
import { IntegrationManager } from '../../integration/registry/integration.manager';
import { DatabaseService } from 'src/common/database/services/database.service';
import { DEVICE_JOBS } from 'src/app/enums/device-job.enum';

@Processor(APP_BULLMQ_QUEUES.DEVICE_CONTROL)
export class DeviceControlProcessor extends WorkerHost {
    private readonly logger = new Logger(DeviceControlProcessor.name);

    constructor(
        private readonly integrationManager: IntegrationManager,
        private readonly databaseService: DatabaseService,
        private readonly socketGateway: SocketGateway
    ) {
        super();
    }

    async process(job: Job): Promise<any> {
        // ✅ 1. Kiểm tra Job Name để xử lý đúng logic
        switch (job.name) {
            case DEVICE_JOBS.CONTROL_CMD:
                return await this.handleControlCommand(job);

            // Có thể mở rộng thêm các loại Job khác tại đây
            // case DEVICE_JOBS.REBOOT_DEVICE:
            //     return await this.handleReboot(job);

            default:
                this.logger.warn(`Unknown job name: ${job.name}`);
                return;
        }
    }

    /**
     * Logic xử lý điều khiển thiết bị
     */
    private async handleControlCommand(job: Job): Promise<any> {
        const { deviceId, featureCode, value } = job.data;

        this.logger.log(
            `🚀 Executing control command: ${deviceId} -> ${featureCode}:${value}`
        );

        // 1. Truy vấn DB lấy thông tin Driver & Protocol
        const device = await this.databaseService.device.findUnique({
            where: { id: deviceId },
            include: {
                partner: true,
                deviceModel: true,
                features: true,
            },
        });

        if (!device) {
            this.logger.error(`Device ${deviceId} not found`);
            return;
        }

        const feature = device.features.find(f => f.code === featureCode);
        if (!feature) {
            this.logger.error(
                `Feature ${featureCode} not found on device ${device.token}`
            );
            return;
        }

        try {
            // 2. Lấy Driver (MQTT, Zigbee...) từ Registry
            const driver = this.integrationManager.getDriver(device.protocol);

            // 3. Thực thi qua Driver
            await driver.setValue(device, feature, value);

            // 4. Thông báo cho người dùng qua WebSocket
            this.socketGateway.server
                .to(`device_${device.token}`)
                .emit('COMMAND_SENT', {
                    deviceId: device.id,
                    featureCode,
                    value,
                    timestamp: new Date(),
                    status: 'sent',
                });

            this.logger.log(
                `✅ [${driver.name}] Command dispatched for ${device.token}`
            );
            return { success: true };
        } catch (error) {
            this.logger.error(`❌ Failed to control device: ${error.message}`);

            this.socketGateway.server
                .to(`device_${device.token}`)
                .emit('COMMAND_ERROR', {
                    deviceId: device.id,
                    error: error.message,
                });

            throw error; // Ném lỗi để BullMQ thực hiện retry (theo config attempts)
        }
    }
}
