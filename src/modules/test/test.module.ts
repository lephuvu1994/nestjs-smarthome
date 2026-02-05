import { Module } from '@nestjs/common';
import { TestController } from './test.controller';
import { TestService } from './test.service';

@Module({
    imports: [], // Vì MqttModule đã là @Global() nên không cần import lại ở đây
    controllers: [TestController],
    providers: [TestService],
})
export class TestModule {}
