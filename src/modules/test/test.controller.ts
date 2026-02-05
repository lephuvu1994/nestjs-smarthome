import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TestService } from './test.service';
import { PublicRoute } from 'src/common/request/decorators/request.public.decorator';

@ApiTags('Test API') // Tên hiển thị trên Swagger
@Controller('test') // Đường dẫn gốc: /test
export class TestController {
    constructor(private readonly testService: TestService) {}

    @Get('hello') // Đường dẫn con: /test/hello
    @PublicRoute()
    @ApiOperation({ summary: 'API trả về Hello World và bắn MQTT' })
    getHello() {
        return this.testService.sayHello();
    }
}
