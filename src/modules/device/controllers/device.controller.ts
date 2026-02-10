// src/modules/device/controllers/device.controller.ts
import { Controller, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { DeviceService } from '../services/device.service';
import { RegisterDeviceDto } from '../dto/register-device.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from 'src/common/request/guards/jwt.access.guard';
import { RolesGuard } from 'src/common/request/guards/roles.guard';

@ApiTags('Devices') // Để hiện đẹp trong Swagger
@UseGuards(JwtAccessGuard, RolesGuard)
@ApiBearerAuth('accessToken')
@Controller('/devices')
export class DeviceController {
    constructor(private readonly deviceService: DeviceService) {}

    @Post('register')
    async registerDevice(@Req() req: any, @Body() dto: RegisterDeviceDto) {
        // req.user: User đang cầm điện thoại
        // dto.identifier: MAC address mà App vừa đọc được từ Chip qua BLE
        return await this.deviceService.registerAndClaim(req.user.userId, dto);
    }

    @Post(':token/setValue')
    async setValue(
        @Param('token') token: string,
        @Body() body: { category: string; type: string; value: any }
    ) {
        return await this.deviceService.publishControlCommand(
            token,
            body.category,
            body.type,
            body.value
        );
    }
}
