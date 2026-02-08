import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DocResponse } from 'src/common/doc/decorators/doc.response.decorator';
import { PublicRoute } from 'src/common/request/decorators/request.public.decorator';
import { RegisterDeviceDto, DeviceProvisioningResponseDto } from '../dtos/register-device.dto';
import { ProvisioningService } from '../services/provisioning.service';

@ApiTags('device.provisioning')
@Controller({
    version: '1',
    path: '/provisioning',
})
export class ProvisioningController {
    constructor(private readonly provisioningService: ProvisioningService) {}

    @Post('register')
    @PublicRoute() // Chip chưa có Auth header nên phải Public
    @ApiOperation({
        summary: 'Register/Provisioning device from Embedded Chip',
        description: 'Chip gửi MAC, CompanyCode, DeviceCode để lấy MQTT Credentials',
    })
    @DocResponse({
        httpStatus: HttpStatus.OK,
        serialization: DeviceProvisioningResponseDto,
       messageKey: 'provisioning.success.registerNewDevice',
    })
    public async register(@Body() body: RegisterDeviceDto): Promise<DeviceProvisioningResponseDto> {
        return this.provisioningService.registerFromChip(body);
    }
}
