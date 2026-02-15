import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from 'src/common/database/services/database.service';
import { RedisService } from 'src/common/redis/services/redis.service';
import { BadRequestException } from '@nestjs/common';
import { DeviceProtocol } from '@prisma/client';
import { DeviceProvisioningService } from 'src/modules/device/services/device-provisioning.service';

describe('DeviceProvisioningService', () => {
    let service: DeviceProvisioningService;
    let dbMock: any;
    let redisMock: any;

    const mockUserId = 'user-uuid-123';
    const mockDto = {
        deviceCode: 'ESP32_RELAY_4CH',
        partner_id: 'partner-uuid-999',
        identifier: 'AA:BB:CC:DD:EE:FF',
        name: 'Công tắc sân vườn',
        protocol: DeviceProtocol.MQTT,
        homeId: 'home-uuid-001',
    };

    beforeEach(async () => {
        // Cấu trúc mock DB hỗ trợ Transaction
        dbMock = {
            deviceModel: { findUnique: jest.fn() },
            partner: { findUnique: jest.fn() },
            hardwareRegistry: {
                findUnique: jest.fn(),
                update: jest.fn(),
                create: jest.fn(),
            },
            device: {
                findUnique: jest.fn(),
                delete: jest.fn(),
                create: jest.fn(),
            },
            $transaction: jest.fn(callback => callback(dbMock)),
        };

        redisMock = {
            del: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeviceProvisioningService,
                { provide: DatabaseService, useValue: dbMock },
                { provide: RedisService, useValue: redisMock },
            ],
        }).compile();

        service = module.get<DeviceProvisioningService>(
            DeviceProvisioningService
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('registerAndClaim', () => {
        it('nên tạo Hardware và Device mới nếu thiết bị chưa từng được đăng ký (New Flow)', async () => {
            // 1. Setup Mocks cho Model và Partner
            dbMock.deviceModel.findUnique.mockResolvedValue({
                id: 'm1',
                featuresConfig: {
                    features: [
                        { code: 'relay_1', name: 'Rơ le 1', type: 'switch' },
                    ],
                },
            });
            dbMock.partner.findUnique.mockResolvedValue({
                id: 'p1',
                code: 'HMT_SMART',
            });

            // Giả lập chưa có hardware trong DB
            dbMock.hardwareRegistry.findUnique.mockResolvedValue(null);

            dbMock.hardwareRegistry.create.mockResolvedValue({
                id: 'hw-new',
                mqttBroker: 'mqtt.hmt.com',
            });

            dbMock.device.create.mockResolvedValue({
                id: 'dev-new',
                token: 'generated-uuid-token',
                features: [{ code: 'relay_1' }],
            });

            // 2. Thực thi
            const result = await service.registerAndClaim(
                mockUserId,
                mockDto as any
            );

            // 3. Kiểm tra logic Hardware Create
            expect(dbMock.hardwareRegistry.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    identifier: mockDto.identifier,
                    partner_id: 'p1',
                }),
            });

            // 4. Kiểm tra logic Device Create (Đảm bảo dùng connect cho owner)
            expect(dbMock.device.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        owner: { connect: { id: mockUserId } },
                        features: {
                            create: [
                                {
                                    code: 'relay_1',
                                    name: 'Rơ le 1',
                                    type: 'switch',
                                    read_only: false,
                                    last_value: '0',
                                },
                            ],
                        },
                    }),
                })
            );

            // 5. Kiểm tra MQTT Config trả về cho Chip
            expect(result.mqttConfig).toBeDefined();
            expect(result.mqttConfig.topicCommand).toContain('HMT_SMART');
            expect(result.mqttConfig.topicCommand).toContain('/+/set');
        });

        it('nên chiếm quyền điều khiển (Takeover) nếu phần cứng đã thuộc về người khác (Reset Flow)', async () => {
            const existingHw = {
                id: 'hw-existing',
                identifier: mockDto.identifier,
            };
            const oldDevice = { id: 'dev-old', token: 'token-old-123' };

            dbMock.deviceModel.findUnique.mockResolvedValue({
                id: 'm1',
                featuresConfig: { features: [] },
            });
            dbMock.partner.findUnique.mockResolvedValue({
                id: 'p1',
                code: 'PARTNER_A',
            });

            // Giả lập hardware đã tồn tại
            dbMock.hardwareRegistry.findUnique.mockResolvedValue(existingHw);
            dbMock.device.findUnique.mockResolvedValue(oldDevice);

            dbMock.hardwareRegistry.update.mockResolvedValue({
                ...existingHw,
                mqttBroker: 'lb',
            });
            dbMock.device.create.mockResolvedValue({
                id: 'dev-new',
                token: 'token-new',
            });

            // 2. Thực thi
            await service.registerAndClaim(mockUserId, mockDto as any);

            // 3. Kiểm tra việc dọn dẹp dữ liệu cũ
            expect(dbMock.device.delete).toHaveBeenCalledWith({
                where: { id: oldDevice.id },
            });
            expect(redisMock.del).toHaveBeenCalledWith(
                `status:${oldDevice.token}`
            );
            expect(redisMock.del).toHaveBeenCalledWith(
                `shadow:${oldDevice.token}`
            );

            // 4. Kiểm tra cập nhật Hardware sang Token mới
            expect(dbMock.hardwareRegistry.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: existingHw.id },
                    data: expect.objectContaining({
                        deviceToken: expect.any(String),
                    }),
                })
            );
        });

        it('nên báo lỗi BadRequest nếu User ID bị trống', async () => {
            await expect(
                service.registerAndClaim('', mockDto as any)
            ).rejects.toThrow(BadRequestException);
        });

        it('nên báo lỗi BadRequest nếu Device Code không tồn tại trong hệ thống', async () => {
            dbMock.deviceModel.findUnique.mockResolvedValue(null);

            await expect(
                service.registerAndClaim(mockUserId, mockDto as any)
            ).rejects.toThrow(BadRequestException);
        });
    });
});
