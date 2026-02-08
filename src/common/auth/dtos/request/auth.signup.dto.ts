import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    Length,
    Matches,
    MinLength,
    ValidateIf,
} from 'class-validator';

export class UserCreateDto {
    @ApiProperty({
        description: 'Tên (First Name)',
        example: faker.person.firstName(),
        required: false,
    })
    @IsString()
    @IsOptional()
    @Length(1, 50)
    public firstName?: string;

    @ApiProperty({
        description: 'Họ (Last Name)',
        example: faker.person.lastName(),
        required: false,
    })
    @IsString()
    @IsOptional()
    @Length(1, 50)
    public lastName?: string;

    // --- LOGIC EMAIL HOẶC PHONE ---

    @ApiProperty({
        description: 'Email (Bắt buộc nếu không có Số điện thoại)',
        example: faker.internet.email(),
        required: false,
    })
    // ValidateIf: Chỉ validate dòng này nếu field 'phone' bị trống
    @ValidateIf((o) => !o.phone)
    @IsNotEmpty({ message: 'Email không được để trống nếu thiếu SĐT' })
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    public email?: string;

    @ApiProperty({
        description: 'Số điện thoại (Bắt buộc nếu không có Email)',
        example: faker.phone.number(),
        required: false,
    })
    // ValidateIf: Chỉ validate dòng này nếu field 'email' bị trống
    @ValidateIf((o) => !o.email)
    @IsNotEmpty({ message: 'SĐT không được để trống nếu thiếu Email' })
    @IsString()
    // Bạn có thể thêm Regex cho số điện thoại VN ở đây nếu muốn
    // @Matches(/(84|0[3|5|7|8|9])+([0-9]{8})\b/, { message: 'SĐT không hợp lệ' })
    public phone?: string;

    // --- PASSWORD (Copy từ logic cũ sang vì không kế thừa nữa) ---

    @ApiProperty({
        description: 'Mật khẩu',
        example: `${faker.string.alphanumeric(5).toLowerCase()}${faker.string
            .alphanumeric(5)
            .toUpperCase()}@@!${faker.number.int(1000)}`,
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(8, { message: 'Mật khẩu phải từ 8 ký tự trở lên' })
    @Matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        { message: 'Mật khẩu quá yếu (cần chữ hoa, thường, số và ký tự đặc biệt)' }
    )
    public password: string;
}
