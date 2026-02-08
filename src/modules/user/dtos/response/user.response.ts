import { faker } from '@faker-js/faker';
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { $Enums, User } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';
import {
    IsDate,
    IsEmail,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    IsBoolean,
    IsNumber,
} from 'class-validator';

export class UserResponseDto {
    @ApiProperty({
        example: faker.string.uuid(),
    })
    @Expose()
    @IsUUID()
    id: string;

    // --- THÔNG TIN LIÊN HỆ (Email hoặc Phone) ---
    @ApiProperty({
        description: 'Email (có thể null nếu đăng ký bằng SĐT)',
        example: faker.internet.email(),
        required: false,
        nullable: true,
    })
    @Expose() // Nếu tên trường DB trùng tên DTO thì không cần { name: ... }
    @IsEmail()
    @IsOptional()
    email: string | null;

    @ApiProperty({
        description: 'Số điện thoại (có thể null nếu đăng ký bằng Email)',
        example: faker.phone.number(),
        required: false,
        nullable: true,
    })
    @Expose()
    @IsString()
    @IsOptional()
    phone: string | null;

    // --- HỌ TÊN (Map từ snake_case DB sang camelCase DTO) ---
    @ApiProperty({
        example: faker.person.firstName(),
        required: false,
        nullable: true,
    })
    @Expose({ name: 'firstname' }) // <--- QUAN TRỌNG: Lấy dữ liệu từ cột 'firstname'
    @IsString()
    @IsOptional()
    firstName: string | null;

    @ApiProperty({
        example: faker.person.lastName(),
        required: false,
        nullable: true,
    })
    @Expose({ name: 'lastname' }) // <--- QUAN TRỌNG: Lấy dữ liệu từ cột 'lastname'
    @IsString()
    @IsOptional()
    lastName: string | null;

    // --- THÔNG TIN KHÁC ---
    @ApiProperty({
        example: faker.image.avatar(),
        required: false,
        nullable: true,
    })
    @Expose()
    @IsString()
    @IsOptional()
    avatar: string | null;

    // Nếu DB không còn cột userName, bạn có thể xóa hoặc dùng @Expose để tự tạo
    @ApiProperty({
        example: faker.internet.username(),
        required: false,
    })
    @Expose()
    @IsOptional()
    userName?: string;

    @ApiProperty({
        enum: $Enums.UserRole,
        example: $Enums.UserRole.USER,
    })
    @Expose()
    @IsEnum($Enums.UserRole)
    role: $Enums.UserRole;

    @ApiProperty({
        description: 'Trạng thái xác thực',
        example: true,
    })

    // --- LOCATION (Vị trí cache mới nhất) ---
    @ApiProperty({ description: 'Vĩ độ', required: false, example: 21.0285 })
    @Expose({ name: 'last_latitude' })
    @IsNumber()
    @IsOptional()
    lastLatitude?: number;

    @ApiProperty({ description: 'Kinh độ', required: false, example: 105.8542 })
    @Expose({ name: 'last_longitude' })
    @IsNumber()
    @IsOptional()
    lastLongitude?: number;

    @ApiProperty({ description: 'Thời gian cập nhật vị trí', required: false })
    @Expose({ name: 'last_location_changed' })
    @IsDate()
    @IsOptional()
    lastLocationChanged?: Date;

    // --- TIMESTAMPS (Map từ snake_case) ---
    @ApiProperty({
        example: faker.date.past().toISOString(),
    })
    @Expose({ name: 'created_at' }) // Map từ 'created_at'
    @IsDate()
    createdAt: Date;

    @ApiProperty({
        example: faker.date.recent().toISOString(),
    })
    @Expose({ name: 'updated_at' }) // Map từ 'updated_at'
    @IsDate()
    updatedAt: Date;

    // --- BẢO MẬT (Luôn ẩn Password) ---
    @ApiHideProperty()
    @Exclude()
    password: string;
}

export class UserGetProfileResponseDto extends UserResponseDto {}

export class UserUpdateProfileResponseDto extends UserResponseDto {}
