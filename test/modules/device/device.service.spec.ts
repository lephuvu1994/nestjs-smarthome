import { Test, TestingModule } from '@nestjs/testing';
import { DeviceService } from 'src/modules/device/services/device.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { RedisService } from 'src/common/redis/services/redis.service';
import { getQueueToken } from '@nestjs/bullmq';
import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum';
import { BadRequestException, HttpException } from '@nestjs/common';
import { DeviceProtocol } from '@prisma/client';

describe('DeviceService', () => {
    let service: DeviceService;
    let dbMock: any;
    let redisMock: any;
    let queueMock: any;

    // ✅ TRƯỜNG HỢP QUAN TRỌNG:userId phải là string thuần túy
    const mockUserId = 'user-123';

    const mockDto = {
        deviceCode: 'MODEL_X',
        partner_id: 'partner-123',
        identifier: 'AA:BB:CC:11:22:33',
        name: 'Đèn Phòng Khách',
        protocol: DeviceProtocol.MQTT_WIFI,
    };

    beforeEach(async () => {
        // Cấu trúc mock db khớp hoàn toàn với các hàm tx gọi trong service
        dbMock = {
            deviceModel: {
                findUnique: jest.fn(),
            },
            partner: {
                findUnique: jest.fn(),
            },
            hardwareRegistry: {
                findUnique: jest.fn(),
                update: jest.fn(),
                create: jest.fn(),
            },
            device: {
                findUnique: jest.fn(), // ✅ Fix lỗi findUnique in tx
                delete: jest.fn(),
                create: jest.fn(),
            },
            // Mock transaction thực thi callback với chính dbMock
            $transaction: jest.fn(callback => callback(dbMock)),
        };

        redisMock = {
            set: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
            hset: jest.fn(),
        };
        queueMock = { add: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeviceService,
                { provide: DatabaseService, useValue: dbMock },
                { provide: RedisService, useValue: redisMock },
                {
                    provide: getQueueToken(APP_BULLMQ_QUEUES.DEVICE_CONTROL),
                    useValue: queueMock,
                },
            ],
        }).compile();

        service = module.get<DeviceService>(DeviceService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('registerAndClaim', () => {
        it('should create new hardware and device (New Flow)', async () => {
            // Setup Mock
            dbMock.deviceModel.findUnique.mockResolvedValue({
                id: 'm1',
                featuresConfig: [{ code: 'sw1', name: 'Switch' }],
            });
            dbMock.partner.findUnique.mockResolvedValue({
                id: 'partner-123',
                code: 'P1',
            });
            dbMock.hardwareRegistry.findUnique.mockResolvedValue(null);
            dbMock.hardwareRegistry.create.mockResolvedValue({
                id: 'hw1',
                mqttBroker: 'localhost',
            });
            dbMock.device.create.mockResolvedValue({
                id: 'dev1',
                token: 'token-test',
            });

            // ✅ THỰC THI: Truyền mockUserId (string) vào
            await service.registerAndClaim(mockUserId, mockDto as any);

            // KIỂM TRA
            expect(dbMock.device.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        name: mockDto.name,
                        identifier: mockDto.identifier,
                        // Sửa dòng này để khớp với chuỗi phẳng
                        owner: {
                            connect: { id: mockUserId },
                        },
                        // Dùng cái này nếu token được sinh ngẫu nhiên bằng uuidv4
                        token: expect.any(String),
                    }),
                })
            );
            expect(dbMock.hardwareRegistry.create).toHaveBeenCalled();
        });

        it('should takeover device and update hardware (Reset Flow)', async () => {
            const existingHw = { id: 'hw-old' };
            const oldDevice = { id: 'dev-old', token: 'token-old' };

            dbMock.deviceModel.findUnique.mockResolvedValue({
                id: 'm1',
                featuresConfig: [],
            });
            dbMock.partner.findUnique.mockResolvedValue({ id: 'p1' });
            dbMock.hardwareRegistry.findUnique.mockResolvedValue(existingHw);

            // ✅ Mock findUnique trả về device cũ gắn với hardware
            dbMock.device.findUnique.mockResolvedValue(oldDevice);
            dbMock.hardwareRegistry.update.mockResolvedValue({
                id: 'hw-old',
                mqttBroker: 'lb',
            });
            dbMock.device.create.mockResolvedValue({
                id: 'dev-new',
                token: 'token-new',
            });

            // THỰC THI
            await service.registerAndClaim(mockUserId, mockDto as any);

            // KIỂM TRA
            expect(dbMock.device.delete).toHaveBeenCalledWith({
                where: { id: oldDevice.id },
            });
            expect(redisMock.del).toHaveBeenCalledWith(
                `auth:token:${oldDevice.token}`
            );
            expect(dbMock.hardwareRegistry.update).toHaveBeenCalled();
        });

        it('should throw BadRequestException if userId is empty', async () => {
            await expect(
                service.registerAndClaim('', mockDto as any)
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('publishControlCommand', () => {
        it('should add job to queue if device is online', async () => {
            redisMock.get.mockResolvedValue('online');

            await service.publishControlCommand(
                'token-123',
                'switch',
                'pwr',
                1
            );

            expect(redisMock.hset).toHaveBeenCalled();
            expect(queueMock.add).toHaveBeenCalled();
        });

        it('should throw HttpException if device is offline', async () => {
            redisMock.get.mockResolvedValue(null);

            await expect(
                service.publishControlCommand('token-123', 'switch', 'pwr', 1)
            ).rejects.toThrow(HttpException);
        });
    });
});
