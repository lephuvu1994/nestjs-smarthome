import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDeviceModelDto {
    @ApiProperty({ example: 'SENSOR_HUMIDITY_T1', description: 'Mã Model thiết bị' })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty({ example: 'Cảm biến độ ẩm T1' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'Mô tả chi tiết...', required: false })
    @IsOptional()
    @IsString()
    description?: string;
}
