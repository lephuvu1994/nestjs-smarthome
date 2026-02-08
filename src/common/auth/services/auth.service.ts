import { InjectQueue } from '@nestjs/bullmq';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Queue } from 'bullmq';
import { plainToInstance } from 'class-transformer';

import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum';
import { DatabaseService } from 'src/common/database/services/database.service';
import {
    EmailTemplate,
    ISendEmailParams,
} from 'src/common/helper/interfaces/email.interface';
import { HelperEncryptionService } from '../../helper/services/helper.encryption.service';
import { IAuthUser } from '../../request/interfaces/request.interface';

// DTOs
import { UserLoginDto } from '../dtos/request/auth.login.dto';
import { UserCreateDto } from '../dtos/request/auth.signup.dto';
import { ForgotPasswordDto } from '../dtos/request/forgot.password.dto'; // Cần tạo file này
import { ResetPasswordDto } from '../dtos/request/reset.password.dto'; // Cần tạo file này
import {
    AuthRefreshResponseDto,
    AuthResponseDto,
} from '../dtos/response/auth.response.dto';
import { UserResponseDto } from 'src/modules/user/dtos/response/user.response';
import { IAuthService } from '../interfaces/auth.service.interface';

@Injectable()
export class AuthService implements IAuthService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly helperEncryptionService: HelperEncryptionService,
        @InjectQueue(APP_BULLMQ_QUEUES.EMAIL)
        private readonly emailQueue: Queue
    ) {}

    /**
     * 1. Đăng nhập (Email hoặc Phone)
     */
    public async login(data: UserLoginDto): Promise<AuthResponseDto> {
        const { identifier, password } = data;

        const user = await this.databaseService.user.findFirst({
            where: {
                OR: [{ email: identifier }, { phone: identifier }],
            },
        });

        if (!user) {
            throw new HttpException(
                'auth.error.userNotFound',
                HttpStatus.NOT_FOUND
            );
        }

        const passwordMatched = await this.helperEncryptionService.match(
            user.password,
            password
        );

        if (!passwordMatched) {
            throw new HttpException(
                'auth.error.invalidPassword',
                HttpStatus.BAD_REQUEST
            );
        }

        const tokens = await this.helperEncryptionService.createJwtTokens({
            role: user.role,
            userId: user.id,
        });

        const userDto = plainToInstance(
            UserResponseDto,
            {
                ...user,
                avatar: null,
                userName: user.email ? user.email.split('@')[0] : user.phone,
            },
            {
                excludeExtraneousValues: true,
            }
        );

        return {
            ...tokens,
            user: userDto,
        };
    }

    /**
     * 2. Đăng ký (Không cần verify)
     */
    public async signup(data: UserCreateDto): Promise<AuthResponseDto> {
        const { email, phone, firstName, lastName, password } = data;

        // Check trùng lặp
        const checkConditions = [];
        if (email) checkConditions.push({ email });
        if (phone) checkConditions.push({ phone });

        if (checkConditions.length > 0) {
            const existingUser = await this.databaseService.user.findFirst({
                where: { OR: checkConditions },
            });

            if (existingUser) {
                throw new HttpException(
                    'user.error.userExists',
                    HttpStatus.CONFLICT
                );
            }
        }

        const hashed = await this.helperEncryptionService.createHash(password);

        const createdUser = await this.databaseService.user.create({
            data: {
                email: email || null,
                phone: phone || null,
                password: hashed,
                firstname: firstName?.trim(),
                lastname: lastName?.trim(),
                role: UserRole.USER,
                // isVerified: true (Mặc định trong schema)
            },
        });

        const tokens = await this.helperEncryptionService.createJwtTokens({
            role: createdUser.role,
            userId: createdUser.id,
        });

        // Chỉ gửi mail nếu có email
        if (email) {
            const emailJobPayload: Partial<ISendEmailParams> = {
                to: email,
                context: {
                    userName: `${firstName} ${lastName}`.trim() || 'User',
                },
            };

            // BullMQ: Tên job (EmailTemplate.WELCOME) là bắt buộc để Worker switch-case
            await this.emailQueue.add(EmailTemplate.WELCOME, emailJobPayload, {
                delay: 5000,
                // Cấu hình tối ưu cho BullMQ
                removeOnComplete: true, // Xóa job khi xong để tiết kiệm RAM Redis
                attempts: 3, // Thử lại nếu server mail lag
                backoff: {
                    type: 'exponential',
                    delay: 2000, // Đợi 2s trước khi thử lại
                },
            });
        }

        const userDto = plainToInstance(
            UserResponseDto,
            {
                ...createdUser,
                avatar: null,
                userName: email ? email.split('@')[0] : phone,
            },
            {
                excludeExtraneousValues: true,
            }
        );

        return {
            ...tokens,
            user: userDto,
        };
    }

    /**
     * 3. Refresh Token
     */
    public async refreshTokens(
        payload: IAuthUser
    ): Promise<AuthRefreshResponseDto> {
        return this.helperEncryptionService.createJwtTokens({
            userId: payload.userId,
            role: payload.role,
        });
    }

    /**
     * 4. Quên mật khẩu (Logic mới: Switch Email/SMS)
     */
    public async forgotPassword(data: ForgotPasswordDto): Promise<void> {
        const { identifier } = data;

        // A. Xác định loại identifier
        const isEmail = identifier.includes('@');

        // B. Tìm user
        const user = await this.databaseService.user.findFirst({
            where: {
                [isEmail ? 'email' : 'phone']: identifier,
            },
        });

        if (!user) {
            throw new HttpException(
                'user.error.notFound',
                HttpStatus.NOT_FOUND
            );
        }

        // C. Tạo OTP 6 số ngẫu nhiên & Hết hạn sau 5 phút
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpire = new Date(Date.now() + 5 * 60 * 1000);

        // D. Lưu OTP vào DB
        // Lưu ý: Đảm bảo bảng User trong schema.prisma đã có cột `otpCode` và `otpExpire`
        await this.databaseService.user.update({
            where: { id: user.id },
            data: {
                // @ts-ignore: Bỏ qua check TS nếu chưa chạy generate lại prisma
                otpCode: otp,
                // @ts-ignore
                otpExpire: otpExpire,
            },
        });

        // E. Gửi OTP qua kênh tương ứng
        if (isEmail) {
            const emailJobPayload: Partial<ISendEmailParams> = {
                to: user.email,
                context: {
                    userName: `${user.firstname} ${user.lastname}`,
                    otp: otp,
                },
            };
            // Gửi qua Email Queue
            await this.emailQueue.add(
                EmailTemplate.FORGOT_PASSWORD,
                emailJobPayload,
                {
                    removeOnComplete: true,
                    attempts: 3,
                    priority: 1, // Email OTP nên được ưu tiên xử lý trước email welcome
                }
            );
        } else {
            // Gửi qua SMS (Logic giả lập)
            await this.sendSMS(user.phone, otp);
        }
    }

    /**
     * 5. Đặt lại mật khẩu (Verify OTP và đổi pass)
     */
    public async resetPassword(data: ResetPasswordDto): Promise<void> {
        const { identifier, otp, newPassword } = data;
        const isEmail = identifier.includes('@');

        // Tìm user có identifier khớp VÀ otp khớp VÀ chưa hết hạn
        const user = await this.databaseService.user.findFirst({
            where: {
                [isEmail ? 'email' : 'phone']: identifier,
                // @ts-ignore
                otpCode: otp,
                // @ts-ignore
                otpExpire: {
                    gt: new Date(), // Thời gian hết hạn phải lớn hơn hiện tại
                },
            },
        });

        if (!user) {
            throw new HttpException(
                'auth.error.invalidOtpOrExpired',
                HttpStatus.BAD_REQUEST
            );
        }

        // Hash mật khẩu mới
        const hashedPassword =
            await this.helperEncryptionService.createHash(newPassword);

        // Cập nhật mật khẩu và xóa OTP
        await this.databaseService.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                // @ts-ignore
                otpCode: null,
                // @ts-ignore
                otpExpire: null,
            },
        });
    }

    /**
     * Helper: Giả lập gửi SMS
     */
    private async sendSMS(phone: string, otp: string) {
        // Sau này tích hợp Twilio / eSMS / Viettel vào đây
        console.log(
            `[SMS MOCK] Gửi đến ${phone}: Mã xác thực của bạn là ${otp}`
        );
        return true;
    }
}
