import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { MqttService } from 'src/common/mqtt/mqtt.service';
import { RedisService } from 'src/common/redis/services/redis.service';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum';
import { SocketGateway } from 'src/modules/socket/gateways/socket.gateway';
import { DEVICE_JOBS } from 'src/app/enums/device-job.enum';

@Injectable()
export class MqttInboundService implements OnApplicationBootstrap {
    // 2. Implements Interface mới
    constructor(
        private mqttService: MqttService,
        private redisService: RedisService,
        private readonly socketGateway: SocketGateway,
        @InjectQueue(APP_BULLMQ_QUEUES.DEVICE_STATUS) private statusQueue: Queue
    ) {}

    // 3. Đổi tên hàm từ onModuleInit -> onApplicationBootstrap
    onApplicationBootstrap() {
        // Lúc này chắc chắn MqttService đã connect xong và this.client đã có
        this.mqttService.subscribe(
            '+/+/+/status',
            this.handleStatusMessage.bind(this)
        );
        this.mqttService.subscribe(
            '+/+/+/telemetry',
            this.handleTelemetryMessage.bind(this)
        );
        this.mqttService.subscribe(
            '+/+/+/state',
            this.handleStateMessage.bind(this)
        );

        console.log('MqttInboundService initialized subscribers');
    }

    private async handleStatusMessage(topic: string, payload: Buffer) {
        // 1. Trích xuất token và kiểm tra hợp lệ
        const deviceToken = this.extractToken(topic);

        // ✅ THÊM DÒNG NÀY: Nếu không có token thì dừng ngay
        // Điều này sẽ giúp test "expect(...).not.toHaveBeenCalled()" PASS hoàn toàn
        if (!deviceToken) {
            return;
        }

        const status = payload.toString();

        // 2. Update Redis
        await this.redisService.set(`status:${deviceToken}`, status);

        // 3. Đẩy vào Queue
        await this.statusQueue.add(DEVICE_JOBS.UPDATE_LAST_SEEN, {
            token: deviceToken,
            status,
        });

        console.log(`Device ${deviceToken} is now ${status}`);
    }

    // Xử lý Telemetry (Nhiệt độ, độ ẩm...)
    private async handleTelemetryMessage(topic: string, payload: Buffer) {
        // Parse JSON -> Update Redis Shadow -> Push to TimescaleDB Worker
    }

    // [MỚI] Xử lý Phản hồi trạng thái (Feedback)
    private async handleStateMessage(topic: string, payload: Buffer) {
        const token = this.extractToken(topic);
        try {
            const data = JSON.parse(payload.toString());
            // data: { "state": "ON", "brightness": 100 } hoặc { "position": 50 }

            // 1. Cập nhật Shadow State vào Redis (Để lần sau mở App lên thấy ngay)
            await this.redisService.hmset(`shadow:${token}`, data);

            // 2. Bắn Socket báo cho Frontend cập nhật UI ngay lập tức
            // App lắng nghe event "DEVICE_UPDATE"
            this.socketGateway.server
                .to(`device_${token}`)
                .emit('DEVICE_UPDATE', {
                    token: token,
                    data: data,
                    timestamp: new Date(),
                });

            // console.log(`[STATE] Device ${token} updated:`, data);
        } catch (e) {
            console.error(`Invalid JSON in state message from ${token}`, e);
        }
    }
    private extractToken(topic: string): string {
        // ✅ Thêm dòng này để bảo vệ hàm khỏi giá trị null hoặc undefined
        if (!topic || typeof topic !== 'string') {
            return null;
        }

        const parts = topic.split('/');
        if (!parts || parts.length < 4) {
            console.error(`Invalid topic format: ${topic}`);
            return null;
        }
        // Ví dụ topic: "COMPANY_A/DEVICE_CODE/DEVICE_TOKEN/status"
        return parts[2];
    }
}
