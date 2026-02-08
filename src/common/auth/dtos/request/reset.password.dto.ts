import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsString()
    @IsNotEmpty()
    identifier: string;

    @ApiProperty({ example: '123456', description: 'Mã OTP 6 số' })
    @IsString()
    @IsNotEmpty()
    otp: string;

    @ApiProperty({ example: 'NewPass@123' })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    newPassword: string;
}
