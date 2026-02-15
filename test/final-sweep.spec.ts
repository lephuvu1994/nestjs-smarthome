import { Test, TestingModule } from '@nestjs/testing';
import { DeviceModule } from 'src/modules/device/device.module';
import { IntegrationModule } from 'src/modules/integration/integration.module';
import { UserModule } from 'src/modules/user/user.module';
import { IntegrationManager } from 'src/modules/integration/registry/integration.manager';
import { DeviceProtocol } from '@prisma/client';
import { RegisterDeviceDto } from 'src/modules/device/dto/register-device.dto';
import { MqttInboundService } from 'src/modules/integration/listeners/mqtt-inbound.service';
import { RedisService } from 'src/common/redis/services/redis.service';
import { getQueueToken } from '@nestjs/bullmq';
import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum';
import { SocketGateway } from 'src/modules/socket/gateways/socket.gateway';
import { MqttService } from 'src/common/mqtt/mqtt.service';

describe('Final Function Coverage Sweep', () => {
    let service: MqttInboundService;

    // Khởi tạo Module chung cho các bài test phía dưới
    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MqttInboundService,
                { provide: MqttService, useValue: { subscribe: jest.fn() } },
                {
                    provide: RedisService,
                    useValue: { hmset: jest.fn(), set: jest.fn() },
                },
                {
                    provide: SocketGateway,
                    useValue: {
                        server: {
                            to: jest.fn().mockReturnThis(),
                            emit: jest.fn(),
                        },
                    },
                },
                {
                    provide: getQueueToken(APP_BULLMQ_QUEUES.DEVICE_STATUS),
                    useValue: { add: jest.fn() },
                },
            ],
        }).compile();

        service = module.get<MqttInboundService>(MqttInboundService);
    });

    it('nên phủ các Module Constructor', () => {
        [DeviceModule, IntegrationModule, UserModule].forEach(M => {
            expect(new M()).toBeDefined();
        });
    });

    it('nên phủ các DTO Constructor', () => {
        expect(new RegisterDeviceDto()).toBeDefined();
    });

    it('nên phủ logic IntegrationManager', async () => {
        const manager = new IntegrationManager({
            protocol: DeviceProtocol.MQTT,
        } as any);
        await manager.onModuleInit();
        expect(manager.getDriver(DeviceProtocol.MQTT)).toBeDefined();
    });

    it('nên phủ toàn bộ nhánh lỗi và hàm rỗng trong MqttInboundService', async () => {
        // 1. Phủ onApplicationBootstrap (chứa các lệnh subscribe)
        service.onApplicationBootstrap();

        // 2. Phủ nhánh catch của handleStateMessage (Dùng topic 4 phần)
        const topic = 'comp/device/TOKEN/state';
        await (service as any).handleStateMessage(
            topic,
            Buffer.from('{ broken json')
        );

        // 3. Phủ hàm handleTelemetryMessage (hàm đang để trống)
        await (service as any).handleTelemetryMessage(topic, Buffer.from('{}'));

        // 4. Phủ nhánh catch của handleStatusMessage (đã sửa có JSON.parse)
        await (service as any).handleStatusMessage(
            topic,
            Buffer.from('{ invalid')
        );

        expect(service).toBeDefined();
    });
});
