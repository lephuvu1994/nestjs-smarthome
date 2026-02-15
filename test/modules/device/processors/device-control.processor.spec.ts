import { Test, TestingModule } from '@nestjs/testing';
import { DeviceControlProcessor } from 'src/modules/device/processors/device-control.processor';
import { IntegrationManager } from 'src/modules/integration/registry/integration.manager';
import { DatabaseService } from 'src/common/database/services/database.service';
import { SocketGateway } from 'src/modules/socket/gateways/socket.gateway';
import { DEVICE_JOBS } from 'src/app/enums/device-job.enum'; // ✅ Đã sửa đường dẫn Enum

describe('DeviceControlProcessor', () => {
    let processor: DeviceControlProcessor;

    // Mock Driver
    const mockDriver = {
        setValue: jest.fn().mockResolvedValue(true),
        name: 'MQTT_GENERIC',
    };

    // Mock Services
    const mockIntegrationManager = {
        getDriver: jest.fn().mockReturnValue(mockDriver),
    };

    const mockDatabaseService = {
        device: { findUnique: jest.fn() },
    };

    const mockSocketGateway = {
        server: { to: jest.fn().mockReturnThis(), emit: jest.fn() },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeviceControlProcessor,
                // ✅ Inject IntegrationManager thay cho MQTT_SERVICE cũ
                {
                    provide: IntegrationManager,
                    useValue: mockIntegrationManager,
                },
                { provide: DatabaseService, useValue: mockDatabaseService },
                { provide: SocketGateway, useValue: mockSocketGateway },
            ],
        }).compile();

        processor = module.get<DeviceControlProcessor>(DeviceControlProcessor);
    });

    it('should be defined', () => {
        expect(processor).toBeDefined();
    });

    it('should process job correctly and call driver', async () => {
        const mockJob: any = {
            name: DEVICE_JOBS.CONTROL_CMD,
            data: { deviceId: 'd-123', featureCode: 'relay_1', value: 1 },
        };

        // Giả lập dữ liệu thiết bị trong DB
        mockDatabaseService.device.findUnique.mockResolvedValue({
            id: 'd-123',
            token: 'token-abc',
            protocol: 'mqtt',
            features: [{ code: 'relay_1' }],
        });

        await processor.process(mockJob);

        expect(mockIntegrationManager.getDriver).toHaveBeenCalledWith('mqtt');
        expect(mockDriver.setValue).toHaveBeenCalled();
        expect(mockSocketGateway.server.emit).toHaveBeenCalledWith(
            'COMMAND_SENT',
            expect.any(Object)
        );
    });
});
