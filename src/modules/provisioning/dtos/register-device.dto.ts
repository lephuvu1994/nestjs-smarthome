import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class RegisterDeviceDto {
    @ApiProperty({
        description: 'Địa chỉ MAC vật lý của thiết bị',
        example: 'AA:BB:CC:11:22:33',
    })
    @IsString()
    @IsNotEmpty()
    // Regex check MAC address đơn giản
    @Matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, {
        message: 'Invalid MAC address format',
    })
    mac: string;

    @ApiProperty({
        description: 'Mã Model thiết bị (được nạp cứng trong firmware)',
        example: 'WIFI_SWITCH_4',
    })
    @IsString()
    @IsNotEmpty()
    deviceCode: string;

    @ApiProperty({
        description: 'Mã Công ty/Đối tác (được nạp cứng hoặc config trong firmware)',
        example: 'COMPANY_A',
    })
    @IsString()
    @IsNotEmpty()
    companyCode: string;
}

// DTO Response trả về cho Chip
export class DeviceProvisioningResponseDto {
    @ApiProperty()
    deviceToken: string;

    @ApiProperty()
    mqttBroker: string;

    @ApiProperty()
    encryptedData: string;
}
