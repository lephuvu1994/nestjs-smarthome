import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from 'src/modules/admin/admin.service'; // Điều chỉnh path nếu cần
import { DatabaseService } from 'src/common/database/services/database.service';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('AdminService', () => {
    let service: AdminService;
    let dbMock: any;

    beforeEach(async () => {
        // Mock cấu trúc DatabaseService
        dbMock = {
            partner: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            deviceModel: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                create: jest.fn(),
            },
            licenseQuota: {
                findMany: jest.fn(),
                updateMany: jest.fn(),
                upsert: jest.fn(),
            },
            systemConfig: {
                upsert: jest.fn(),
            },
            // Mock transaction trả về chính dbMock để tx.partner.update hoạt động
            $transaction: jest.fn(callback => callback(dbMock)),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdminService,
                { provide: DatabaseService, useValue: dbMock },
            ],
        }).compile();

        service = module.get<AdminService>(AdminService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createPartner', () => {
        it('should throw ConflictException if partner code exists', async () => {
            dbMock.partner.findUnique.mockResolvedValue({
                id: '1',
                code: 'P1',
            });

            await expect(
                service.createPartner({ code: 'P1', name: 'Partner 1' })
            ).rejects.toThrow(
                new HttpException(
                    'Partner Code already exists',
                    HttpStatus.CONFLICT
                )
            );
        });

        it('should create partner successfully', async () => {
            dbMock.partner.findUnique.mockResolvedValue(null);
            dbMock.partner.create.mockResolvedValue({ id: '1', code: 'P1' });

            const result = await service.createPartner({
                code: 'P1',
                name: 'Partner 1',
            });
            expect(result.code).toBe('P1');
            expect(dbMock.partner.create).toHaveBeenCalled();
        });
    });

    describe('getPartnersUsage', () => {
        it('should map database data to PartnerUsageResponseDto correctly', async () => {
            const dbData = [
                {
                    code: 'P1',
                    name: 'Partner 1',
                    quotas: [
                        {
                            activatedCount: 5,
                            maxQuantity: 10,
                            deviceModel: { code: 'M1', name: 'Model 1' },
                        },
                    ],
                },
            ];
            dbMock.partner.findMany.mockResolvedValue(dbData);

            const result = await service.getPartnersUsage();

            expect(result[0].companyCode).toBe('P1');
            expect(result[0].quotas[0].used).toBe(5);
            expect(result[0].quotas[0].modelCode).toBe('M1');
        });
    });

    describe('updatePartner', () => {
        const partnerCode = 'PARTNER_TEST';
        const updateDto = {
            name: 'New Name',
            quotas: [{ deviceModelCode: 'MODEL_A', quantity: 100 }],
        };

        it('should throw Not Found if partner does not exist', async () => {
            dbMock.partner.findUnique.mockResolvedValue(null);

            await expect(
                service.updatePartner(partnerCode, updateDto)
            ).rejects.toThrow(
                new HttpException('Partner not found', HttpStatus.NOT_FOUND)
            );
        });

        it('should update name and upsert quotas inside a transaction', async () => {
            const existingPartner = { id: 'p-123', code: partnerCode };
            const modelA = { id: 'm-aaa', code: 'MODEL_A' };

            // 1. Giả lập tìm thấy Partner
            dbMock.partner.findUnique.mockResolvedValueOnce(existingPartner);
            // 2. Giả lập tìm thấy Model bên trong loop
            dbMock.deviceModel.findUnique.mockResolvedValue(modelA);
            // 3. Giả lập kết quả trả về cuối cùng sau transaction
            dbMock.partner.findUnique.mockResolvedValueOnce({
                ...existingPartner,
                name: 'New Name',
            });

            const result = await service.updatePartner(partnerCode, updateDto);

            expect(dbMock.$transaction).toHaveBeenCalled();
            expect(dbMock.partner.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { code: partnerCode },
                    data: { name: 'New Name' },
                })
            );
            expect(dbMock.licenseQuota.upsert).toHaveBeenCalled();
            expect(result.name).toBe('New Name');
        });

        it('should throw error if device model in quotas not found', async () => {
            dbMock.partner.findUnique.mockResolvedValue({ id: 'p-123' });
            dbMock.deviceModel.findUnique.mockResolvedValue(null); // Model không tồn tại

            await expect(
                service.updatePartner(partnerCode, updateDto)
            ).rejects.toThrow(HttpException);
        });
    });

    describe('setMqttConfig', () => {
        it('should call upsert 3 times for MQTT configs', async () => {
            const configDto = { host: 'localhost', user: 'admin', pass: '123' };

            await service.setMqttConfig(configDto);

            expect(dbMock.systemConfig.upsert).toHaveBeenCalledTimes(3);
            expect(dbMock.systemConfig.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { key: 'MQTT_HOST' },
                })
            );
        });
    });
});
