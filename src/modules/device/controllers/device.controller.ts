// src/modules/device/controllers/device.controller.ts
import {
    Controller,
    Post,
    Body,
    Param,
    Req,
    UseGuards,
    UnauthorizedException,
} from '@nestjs/common';
import { RegisterDeviceDto } from '../dto/register-device.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from 'src/common/request/guards/jwt.access.guard';
import { RolesGuard } from 'src/common/request/guards/roles.guard';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum';
import { DeviceProvisioningService } from '../services/device-provisioning.service';
import { DeviceControlService } from '../services/device-control.service';
import { DEVICE_JOBS } from 'src/app/enums/device-job.enum';

@ApiTags('Devices')
@UseGuards(JwtAccessGuard, RolesGuard)
@ApiBearerAuth('accessToken')
@Controller('/devices')
export class DeviceController {
    constructor(
        private readonly provisioningService: DeviceProvisioningService,
        private readonly deviceControlService: DeviceControlService,
        // Inject Queue để đẩy lệnh điều khiển
        @InjectQueue(APP_BULLMQ_QUEUES.DEVICE_CONTROL)
        private readonly deviceControlQueue: Queue
    ) {}

    @Post('register')
    @ApiOperation({ summary: 'Đăng ký và chiếm quyền sở hữu thiết bị (Claim)' })
    async registerDevice(@Req() req: any, @Body() dto: RegisterDeviceDto) {
        return await this.provisioningService.registerAndClaim(
            req.user.userId,
            dto
        );
    }

    @Post(':id/control')
    @ApiOperation({ summary: 'Gửi lệnh điều khiển thiết bị qua Queue' })
    async sendControlCommand(
        @Param('id') deviceId: string,
        @Req() req: any,
        @Body() body: { featureCode: string; value: any }
    ) {
        // 1. Kiểm tra quyền sở hữu
        const hasPermission =
            await this.deviceControlService.checkUserPermission(
                deviceId,
                req.user.userId
            );

        if (!hasPermission) {
            throw new UnauthorizedException(
                'Bạn không có quyền điều khiển thiết bị này'
            );
        }

        // 2. Gọi Service để xử lý đẩy Queue (Giúp file test Pass)
        return await this.deviceControlService.sendControlCommand(
            deviceId,
            req.user.userId,
            body.featureCode,
            body.value
        );
    }
}
