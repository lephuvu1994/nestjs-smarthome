import { getQueueToken } from '@nestjs/bullmq';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum';
import { AuthService } from 'src/common/auth/services/auth.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { HelperEncryptionService } from 'src/common/helper/services/helper.encryption.service';

describe('AuthService', () => {
    let service: AuthService;

    // ✅ MOCK DATABASE PHẲNG THEO FILE CỦA BẠN
    const mockDatabaseService = {
        user: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
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

    // -----------------------------------------------------------
    // 1. LOGIN & REFRESH (Phủ nhánh sai pass và refreshTokens)
    // -----------------------------------------------------------
    describe('Login & Tokens', () => {
        it('nên ném lỗi khi login sai mật khẩu (Phủ nhánh đỏ login)', async () => {
            mockDatabaseService.user.findFirst.mockResolvedValue({
                id: '1',
                password: 'hash',
            });
            mockHelperEncryptionService.match.mockResolvedValue(false); // Sai pass

            await expect(
                service.login({ identifier: 'test', password: 'wrong' })
            ).rejects.toThrow(HttpException);
        });

        it('nên refresh tokens thành công (Phủ hàm refreshTokens)', async () => {
            const mockAuthUser = { userId: 'user-123', role: UserRole.USER };
            mockHelperEncryptionService.createJwtTokens.mockResolvedValue({
                accessToken: 'new-at',
            });

            const result = await service.refreshTokens(mockAuthUser as any);
            expect(result).toHaveProperty('accessToken');
            expect(
                mockHelperEncryptionService.createJwtTokens
            ).toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------
    // 2. SIGNUP (Phủ nhánh UserExists)
    // -----------------------------------------------------------
    describe('signup', () => {
        it('nên ném lỗi nếu email/sđt đã tồn tại (Phủ nhánh đỏ signup)', async () => {
            mockDatabaseService.user.findFirst.mockResolvedValue({
                id: 'existing',
            });

            await expect(
                service.signup({
                    email: 'existing@test.com',
                    password: '123',
                } as any)
            ).rejects.toThrow(HttpException);
        });
    });

    // -----------------------------------------------------------
    // 3. PASSWORD RECOVERY (Phủ forgotPassword và resetPassword)
    // -----------------------------------------------------------
    describe('Password Recovery', () => {
        const mockUser = { id: 'user-789', email: 'test@example.com' };

        it('forgotPassword: nên ném lỗi nếu không tìm thấy user', async () => {
            mockDatabaseService.user.findFirst.mockResolvedValue(null);
            await expect(
                service.forgotPassword({ identifier: 'none' })
            ).rejects.toThrow(HttpException);
        });

        it('resetPassword: nên đổi mật khẩu thành công khi OTP đúng (Phủ hàm resetPassword)', async () => {
            mockDatabaseService.user.findFirst.mockResolvedValue(mockUser);
            mockHelperEncryptionService.createHash.mockResolvedValue(
                'new-hash'
            );

            const resetDto = {
                identifier: 'test@example.com',
                otp: '123456',
                newPassword: 'new',
            };
            await service.resetPassword(resetDto);

            expect(mockDatabaseService.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: mockUser.id },
                    data: expect.objectContaining({ password: 'new-hash' }),
                })
            );
        });

        it('resetPassword: nên ném lỗi nếu OTP sai hoặc hết hạn', async () => {
            mockDatabaseService.user.findFirst.mockResolvedValue(null);
            await expect(
                service.resetPassword({
                    identifier: 'test',
                    otp: '000',
                    newPassword: '1',
                })
            ).rejects.toThrow(HttpException);
        });
    });
    it('nên phủ nốt các hàm và nhánh lỗi còn lại', async () => {
        // 1. Phủ refreshTokens
        await service.refreshTokens({ userId: '1', role: 'USER' } as any);

        // 2. Phủ resetPassword (nhánh thành công)
        mockDatabaseService.user.findFirst.mockResolvedValue({ id: '1' });
        await service.resetPassword({
            identifier: 'a@a.com',
            otp: '123',
            newPassword: '1',
        });

        // 3. Phủ resetPassword (nhánh lỗi !user)
        mockDatabaseService.user.findFirst.mockResolvedValue(null);
        await expect(
            service.resetPassword({
                identifier: 'b',
                otp: '1',
                newPassword: '1',
            })
        ).rejects.toThrow(HttpException);
    });
    it('nên phủ hàm refreshTokens (Ảnh 3)', async () => {
        mockHelperEncryptionService.createJwtTokens.mockResolvedValue({
            accessToken: 'new-at',
        });
        const result = await service.refreshTokens({
            userId: 'user-123',
            role: 'USER',
        } as any);
        expect(result).toHaveProperty('accessToken');
    });

    it('nên phủ hàm resetPassword và nhánh lỗi (Ảnh 2)', async () => {
        // Nhánh 1: Không tìm thấy User hoặc OTP sai
        mockDatabaseService.user.findFirst.mockResolvedValue(null);
        await expect(
            service.resetPassword({
                identifier: '090',
                otp: '000',
                newPassword: '1',
            })
        ).rejects.toThrow();

        // Nhánh 2: Thành công
        mockDatabaseService.user.findFirst.mockResolvedValue({ id: 'user-1' });
        mockHelperEncryptionService.createHash.mockResolvedValue('hashed-pass');
        await service.resetPassword({
            identifier: '090',
            otp: '123',
            newPassword: 'new',
        });
        expect(mockDatabaseService.user.update).toHaveBeenCalled();
    });

    it('nên phủ nhánh lỗi signup khi user đã tồn tại (Ảnh 4)', async () => {
        mockDatabaseService.user.findFirst.mockResolvedValue({ id: 'existed' });
        await expect(
            service.signup({ email: 'old@test.com' } as any)
        ).rejects.toThrow();
    });
});
