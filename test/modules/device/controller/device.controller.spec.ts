import { Test, TestingModule } from '@nestjs/testing';
import { DeviceController } from 'src/modules/device/controllers/device.controller';
import { DeviceProvisioningService } from 'src/modules/device/services/device-provisioning.service';
import { DeviceControlService } from 'src/modules/device/services/device-control.service';
import { RegisterDeviceDto } from 'src/modules/device/dto/register-device.dto';
import { DeviceProtocol } from '@prisma/client';
import { getQueueToken } from '@nestjs/bullmq';
import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum';

describe('DeviceController', () => {
    let controller: DeviceController;
    let provisioningService: DeviceProvisioningService;
    let controlService: DeviceControlService;

    // Mock dữ liệu đầu vào
    const mockUser = { userId: 'user-123' };
    const mockDeviceId = 'dev-456';
    const mockControlBody = { featureCode: 'relay_1', value: 1 };

    const mockRegisterDto: RegisterDeviceDto = {
        deviceCode: 'MODEL_X',
        partner_id: 'partner-123',
        identifier: 'AA:BB:CC',
        name: 'Test Device',
        protocol: DeviceProtocol.MQTT,
    };

    // Tạo Mock cho các Services
    const mockProvisioningService = {
        registerAndClaim: jest.fn(),
    };

    const mockControlService = {
        sendControlCommand: jest.fn(),
        checkUserPermission: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [DeviceController],
            providers: [
                {
                    provide: DeviceProvisioningService,
                    useValue: mockProvisioningService,
                },
                { provide: DeviceControlService, useValue: mockControlService },
                {
                    provide: getQueueToken(APP_BULLMQ_QUEUES.DEVICE_CONTROL),
                    useValue: { add: jest.fn() },
                },
            ],
        }).compile();

        controller = module.get<DeviceController>(DeviceController);
        provisioningService = module.get<DeviceProvisioningService>(
            DeviceProvisioningService
        );
        controlService = module.get<DeviceControlService>(DeviceControlService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('registerDevice', () => {
        it('nên gọi registerAndClaim của provisioningService', async () => {
            const expectedResult = { id: 'new-dev-id', token: 'abc' };
            mockProvisioningService.registerAndClaim.mockResolvedValue(
                expectedResult
            );

            const result = await controller.registerDevice(
                { user: mockUser },
                mockRegisterDto
            );

            expect(provisioningService.registerAndClaim).toHaveBeenCalledWith(
                mockUser.userId,
                mockRegisterDto
            );
            expect(result).toEqual(expectedResult);
        });
    });

    describe('controlDevice', () => {
        it('nên gọi sendControlCommand khi có quyền điều khiển', async () => {
            const expectedResponse = { success: true, message: 'Queued' };

            // Giả lập check quyền thành công và gửi lệnh thành công
            mockControlService.checkUserPermission.mockResolvedValue(true);
            mockControlService.sendControlCommand.mockResolvedValue(
                expectedResponse
            );

            const result = await controller.sendControlCommand(
                mockDeviceId,
                { user: mockUser },
                mockControlBody
            );

            expect(controlService.checkUserPermission).toHaveBeenCalledWith(
                mockDeviceId,
                mockUser.userId
            );
            expect(controlService.sendControlCommand).toHaveBeenCalledWith(
                mockDeviceId,
                mockUser.userId,
                mockControlBody.featureCode,
                mockControlBody.value
            );
            expect(result).toEqual(expectedResponse);
        });

        it('nên ném lỗi UnauthorizedException nếu không có quyền (Branch Coverage)', async () => {
            // Giả lập check quyền thất bại
            mockControlService.checkUserPermission.mockResolvedValue(false);

            await expect(
                controller.sendControlCommand(
                    mockDeviceId,
                    { user: mockUser },
                    mockControlBody
                )
            ).rejects.toThrow(); // UnauthorizedException được ném ra từ Controller logic
        });
    });
});
