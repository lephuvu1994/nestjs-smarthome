import {
    Injectable,
    HttpException,
    HttpStatus,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum';
import { RedisService } from 'src/common/redis/services/redis.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { DEVICE_JOBS } from 'src/app/enums/device-job.enum';

@Injectable()
export class DeviceControlService {
    constructor(
        @InjectQueue(APP_BULLMQ_QUEUES.DEVICE_CONTROL)
        private deviceQueue: Queue,
        private readonly redisService: RedisService,
        private readonly databaseService: DatabaseService
    ) {}

    /**
     * Hàm kiểm tra quyền sở hữu (Có thể gọi từ Controller hoặc nội bộ)
     */
    async checkUserPermission(
        deviceId: string,
        userId: string
    ): Promise<boolean> {
        const device = await this.databaseService.device.findFirst({
            where: {
                id: deviceId,
                owner_id: userId,
            },
        });
        return !!device;
    }

    async sendControlCommand(
        deviceId: string,
        userId: string,
        featureCode: string,
        value: any
    ) {
        // 1. Kiểm tra nhanh quyền sở hữu
        const device = await this.databaseService.device.findFirst({
            where: { id: deviceId, owner_id: userId },
            select: { token: true },
        });

        if (!device)
            throw new UnauthorizedException(
                'Không có quyền điều khiển thiết bị này'
            );

        // 2. Kiểm tra Online từ Redis (Set bởi MqttInboundService)
        const isOnline = await this.redisService.get(`status:${device.token}`);
        if (isOnline !== 'online') {
            throw new HttpException(
                'Thiết bị đang offline',
                HttpStatus.SERVICE_UNAVAILABLE
            );
        }

        // 3. Đẩy Job vào Queue để Driver thực thi
        await this.deviceQueue.add(
            DEVICE_JOBS.CONTROL_CMD,
            {
                deviceId,
                featureCode,
                value,
            },
            {
                priority: 1,
                attempts: 3,
                backoff: 5000,
                removeOnComplete: true,
            }
        );

        return {
            status: 'queued',
            deviceId,
            featureCode,
            timestamp: new Date(),
        };
    }

    async getShadowState(token: string) {
        return await this.redisService.hgetall(`shadow:${token}`);
    }
}
