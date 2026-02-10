// src/modules/device/processors/device-control.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum';
import { SocketGateway } from 'src/modules/socket/gateways/socket.gateway';
import { IDeviceCommand } from 'src/modules/device/interfaces/device-control.interface';

@Processor(APP_BULLMQ_QUEUES.DEVICE_CONTROL)
export class DeviceControlProcessor extends WorkerHost {
    constructor(
        @Inject('MQTT_SERVICE') private readonly mqttClient: ClientProxy,
        private readonly socketGateway: SocketGateway
    ) {
        super();
    }

    async process(job: Job<IDeviceCommand>): Promise<void> {
        const { category, type, value, token } = job.data;

        // 1. Gửi MQTT đến Chip (Payload phẳng hoàn toàn)
        const topic = `${token}/set`;
        const mqttPayload = { category, type, value };

        // Emit fire-and-forget qua MQTT Broker
        this.mqttClient.emit(topic, mqttPayload);

        // 2. Bắn Websocket báo cho FE: Lệnh đã rời khỏi Server
        this.socketGateway.server.to(`device_${token}`).emit('COMMAND_SENT', {
            token,
            value,
            timestamp: new Date(),
        });
    }
}
