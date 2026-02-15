import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from 'src/common/database/services/database.service';
import { RedisService } from 'src/common/redis/services/redis.service';
import { getQueueToken } from '@nestjs/bullmq';
import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum';
import { UnauthorizedException, HttpException } from '@nestjs/common';
import { DeviceControlService } from 'src/modules/device/services/device-control.service';

describe('DeviceControlService', () => {
    let service: DeviceControlService;
    let db: DatabaseService;
    let redis: RedisService;
    let queue: any;

    const mockQueue = { add: jest.fn() };
    const mockDb = { device: { findFirst: jest.fn(), findUnique: jest.fn() } };
    const mockRedis = { get: jest.fn() };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeviceControlService,
                { provide: DatabaseService, useValue: mockDb },
                { provide: RedisService, useValue: mockRedis },
                {
                    provide: getQueueToken(APP_BULLMQ_QUEUES.DEVICE_CONTROL),
                    useValue: mockQueue,
                },
            ],
        }).compile();

        service = module.get<DeviceControlService>(DeviceControlService);
        db = module.get<DatabaseService>(DatabaseService);
        redis = module.get<RedisService>(RedisService);
        queue = module.get(getQueueToken(APP_BULLMQ_QUEUES.DEVICE_CONTROL));
    });

    it('nên báo lỗi Unauthorized nếu user không sở hữu thiết bị', async () => {
        (db.device.findFirst as jest.Mock).mockResolvedValue(null); // Giả lập không tìm thấy
        await expect(
            service.sendControlCommand('dev1', 'user1', 'p1', 1)
        ).rejects.toThrow(UnauthorizedException);
    });

    it('nên báo lỗi Offline nếu thiết bị không online trong Redis', async () => {
        (db.device.findFirst as jest.Mock).mockResolvedValue({ token: 'tok1' });
        (redis.get as jest.Mock).mockResolvedValue('offline'); // Giả lập offline

        await expect(
            service.sendControlCommand('dev1', 'user1', 'p1', 1)
        ).rejects.toThrow(HttpException);
    });

    it('nên đẩy job vào queue nếu mọi thứ hợp lệ', async () => {
        (db.device.findFirst as jest.Mock).mockResolvedValue({ token: 'tok1' });
        (db.device.findUnique as jest.Mock).mockResolvedValue({
            token: 'tok1',
        });
        (redis.get as jest.Mock).mockResolvedValue('online');

        const result = await service.sendControlCommand(
            'dev1',
            'user1',
            'p1',
            1
        );

        expect(queue.add).toHaveBeenCalled();
        expect(result.status).toBe('queued');
    });
});
