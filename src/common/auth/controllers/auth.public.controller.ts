import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { DocResponse } from 'src/common/doc/decorators/doc.response.decorator';
import { PublicRoute } from 'src/common/request/decorators/request.public.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { JwtRefreshGuard } from 'src/common/request/guards/jwt.refresh.guard';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { UserLoginDto } from '../dtos/request/auth.login.dto';
import { UserCreateDto } from '../dtos/request/auth.signup.dto';
import {
    AuthRefreshResponseDto,
    AuthResponseDto,
} from '../dtos/response/auth.response.dto';
import { AuthService } from '../services/auth.service';

@ApiTags('public.auth')
@Controller({
    version: '1',
    path: '/auth',
})
export class AuthPublicController {
    constructor(private readonly authService: AuthService) {}

    // --- LOGIN (Hỗ trợ Email hoặc Phone) ---
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @PublicRoute()
    @ApiOperation({
        summary: 'Login with Email or Phone',
        description: 'Đăng nhập bằng Email hoặc Số điện thoại và Mật khẩu.'
    })
    @DocResponse({
        serialization: AuthResponseDto,
        httpStatus: HttpStatus.OK,
        messageKey: 'auth.login.success',
    })
    public login(@Body() payload: UserLoginDto): Promise<AuthResponseDto> {
        return this.authService.login(payload);
    }

    // --- SIGNUP (Không cần verify) ---
    @Post('signup')
    @PublicRoute()
    @ApiOperation({
        summary: 'Register new user',
        description: 'Đăng ký tài khoản mới (Email hoặc Phone là bắt buộc). Tự động đăng nhập sau khi đăng ký.'
    })
    @DocResponse({
        serialization: AuthResponseDto,
        httpStatus: HttpStatus.CREATED, // 201 Created
        messageKey: 'auth.signup.success',
    })
    public signup(@Body() payload: UserCreateDto): Promise<AuthResponseDto> {
        return this.authService.signup(payload);
    }

    // --- REFRESH TOKEN ---
    @Get('refresh-token')
    @PublicRoute() // Route này public về mặt AuthGuard chính, nhưng dùng JwtRefreshGuard riêng
    @UseGuards(JwtRefreshGuard)
    @ApiBearerAuth('refreshToken') // Yêu cầu Swagger hiện nút nhập token (cấu hình trong main.ts)
    @ApiOperation({
        summary: 'Refresh Access Token',
        description: 'Sử dụng Refresh Token để lấy cặp Access/Refresh Token mới.'
    })
    @DocResponse({
        serialization: AuthRefreshResponseDto,
        httpStatus: HttpStatus.OK, // Thường refresh trả về 200 OK
        messageKey: 'auth.refresh.success',
    })
    public refreshTokens(
        @AuthUser() user: IAuthUser
    ): Promise<AuthRefreshResponseDto> {
        return this.authService.refreshTokens(user);
    }
}
