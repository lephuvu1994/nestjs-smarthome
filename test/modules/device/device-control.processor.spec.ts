import { Test, TestingModule } from '@nestjs/testing';
import { DeviceControlProcessor } from 'src/modules/device/processors/device-control.processor';
import { SocketGateway } from 'src/modules/socket/gateways/socket.gateway';
import { Job } from 'bullmq';

describe('DeviceControlProcessor', () => {
    let processor: DeviceControlProcessor;
    let mqttClientMock: any;
    let socketGatewayMock: any;

    beforeEach(async () => {
        // 1. Mock MQTT ClientProxy
        mqttClientMock = {
            emit: jest.fn(),
        };

        // 2. Mock SocketGateway với cấu trúc server.to(...).emit(...)
        socketGatewayMock = {
            server: {
                to: jest.fn().mockReturnThis(), // Trả về chính nó để nối chuỗi .emit()
                emit: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeviceControlProcessor,
                { provide: 'MQTT_SERVICE', useValue: mqttClientMock },
                { provide: SocketGateway, useValue: socketGatewayMock },
            ],
        }).compile();

        processor = module.get<DeviceControlProcessor>(DeviceControlProcessor);
    });

    it('should be defined', () => {
        expect(processor).toBeDefined();
    });

    it('should process job, emit MQTT and notify via WebSocket', async () => {
        // Giả lập dữ liệu Job từ BullMQ
        const mockJob = {
            data: {
                token: 'dev-123',
                category: 'light',
                type: 'power',
                value: 1,
            },
        } as Job;

        await processor.process(mockJob);

        // 1. Kiểm tra MQTT Emit
        const expectedTopic = 'dev-123/set';
        const expectedPayload = { category: 'light', type: 'power', value: 1 };
        expect(mqttClientMock.emit).toHaveBeenCalledWith(
            expectedTopic,
            expectedPayload
        );

        // 2. Kiểm tra WebSocket Notify
        expect(socketGatewayMock.server.to).toHaveBeenCalledWith(
            'device_dev-123'
        );
        expect(socketGatewayMock.server.emit).toHaveBeenCalledWith(
            'COMMAND_SENT',
            expect.objectContaining({
                token: 'dev-123',
                value: 1,
                timestamp: expect.any(Date),
            })
        );
    });

    it('should handle errors during processing to let BullMQ retry', async () => {
        // Giả lập lỗi khi bắn MQTT
        mqttClientMock.emit.mockImplementation(() => {
            throw new Error('MQTT Broker Down');
        });

        const mockJob = { data: { token: 'dev-123' } } as Job;

        // Phải throw lỗi để BullMQ biết mà retry
        await expect(processor.process(mockJob)).rejects.toThrow(
            'MQTT Broker Down'
        );
    });
});
