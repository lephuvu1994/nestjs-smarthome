import { Module, Global } from '@nestjs/common';
import { MqttModule } from 'src/common/mqtt/mqtt.module';
import { IntegrationManager } from './registry/integration.manager';
import { MqttGenericDriver } from './drivers/mqtt-generic.driver';
import { MqttInboundService } from './listeners/mqtt-inbound.service';
import { RedisModule } from 'src/common/redis/redis.module'; // Giả định bạn đã có
import { BullModule } from '@nestjs/bullmq';
import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum'; // Enum tên queue

@Global() // Nên để Global vì DeviceModule nào cũng cần dùng Manager
@Module({
    imports: [
        // 1. Cần MQTT để gửi/nhận tin
        MqttModule,

        // 2. Cần Redis để lưu Shadow/Status
        RedisModule,

        // 3. Cần Queue để đẩy job cập nhật DB (tránh nghẽn)
        BullModule.registerQueue({
            name: APP_BULLMQ_QUEUES.DEVICE_STATUS, // Hoặc lấy từ Enum APP_BULLMQ_QUEUES
        }),
    ],
    providers: [
        // Managers
        IntegrationManager,

        // Drivers (Logic Outbound)
        MqttGenericDriver,

        // Listeners (Logic Inbound)
        MqttInboundService,
    ],
    exports: [
        IntegrationManager, // Export cái này để DeviceModule dùng được hàm .getDriver()
    ],
})
export class IntegrationModule {}
