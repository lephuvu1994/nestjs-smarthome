import { getQueueToken } from '@nestjs/bullmq';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, DeviceProtocol } from '@prisma/client';
import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum';
import { AuthService } from 'src/common/auth/services/auth.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { HelperEncryptionService } from 'src/common/helper/services/helper.encryption.service';
import { EmailTemplate } from 'src/common/helper/interfaces/email.interface';

describe('AuthService', () => {
    let service: AuthService;

    // ✅ KHAI BÁO MOCK DATABASE PHẲNG
    const mockDatabaseService = {
        user: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        deviceModel: { findUnique: jest.fn() },
        partner: { findUnique: jest.fn() },
        hardwareRegistry: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        device: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
        $transaction: jest.fn(callback => callback(mockDatabaseService)),
    };

    const mockHelperEncryptionService = {
        match: jest.fn(),
        createHash: jest.fn(),
        createJwtTokens: jest.fn(),
    };

    const mockEmailQueue = {
        add: jest.fn(),
    };

    beforeEach(async () => {
        // ✅ QUAN TRỌNG: Clear mock để tránh rác dữ liệu giữa các case
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: DatabaseService, useValue: mockDatabaseService },
                {
                    provide: HelperEncryptionService,
                    useValue: mockHelperEncryptionService,
                },
                {
                    provide: getQueueToken(APP_BULLMQ_QUEUES.EMAIL),
                    useValue: mockEmailQueue,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    describe('login', () => {
        it('should throw NOT_FOUND if user does not exist', async () => {
            mockDatabaseService.user.findFirst.mockResolvedValue(null);

            await expect(
                service.login({
                    identifier: 'test@example.com',
                    password: '123',
                })
            ).rejects.toThrow(HttpException);
        });

        it('should return tokens and user on success', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                password: 'hash',
                role: UserRole.USER,
            };
            mockDatabaseService.user.findFirst.mockResolvedValue(mockUser);
            mockHelperEncryptionService.match.mockResolvedValue(true);
            mockHelperEncryptionService.createJwtTokens.mockResolvedValue({
                accessToken: 'at',
                refreshToken: 'rt',
            });

            const result = await service.login({
                identifier: 'test@example.com',
                password: '123',
            });

            expect(result).toHaveProperty('accessToken');
            // Kiểm tra user trả về không bị lồng ID
            expect(result.user.id).toBe('user-123');
        });
    });

    describe('signup', () => {
        it('should create user and return tokens', async () => {
            const dto = {
                email: 'new@test.com',
                password: '123',
                firstName: 'A',
                lastName: 'B',
            };
            const createdUser = { id: 'user-456', ...dto, role: UserRole.USER };

            mockDatabaseService.user.findFirst.mockResolvedValue(null);
            mockHelperEncryptionService.createHash.mockResolvedValue('hashed');
            mockDatabaseService.user.create.mockResolvedValue(createdUser);
            mockHelperEncryptionService.createJwtTokens.mockResolvedValue({
                accessToken: 'at',
            });

            const result = await service.signup(dto);

            expect(mockDatabaseService.user.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        email: dto.email,
                    }),
                })
            );
            expect(result.user.id).toBe('user-456');
        });
    });

    // ✅ PHẦN NÀY LÀ NƠI DỄ GÂY LỖI NHẤT (Nếu bạn có test logic Device trong Auth)
    // Đảm bảo truyền string userId trực tiếp
    describe('forgotPassword & resetPassword', () => {
        it('should update OTP and send email', async () => {
            const mockUser = { id: 'user-789', email: 'test@example.com' };
            mockDatabaseService.user.findFirst.mockResolvedValue(mockUser);

            await service.forgotPassword({ identifier: 'test@example.com' });

            expect(mockDatabaseService.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'user-789' }, // Phải là string phẳng
                    data: expect.objectContaining({
                        otpCode: expect.any(String),
                    }),
                })
            );
        });
    });
});
