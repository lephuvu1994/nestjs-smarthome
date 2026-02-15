import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
// ❌ BỎ: import { ClientsModule, Transport } from '@nestjs/microservices';
import { DeviceController } from './controllers/device.controller';
import { DeviceControlProcessor } from './processors/device-control.processor';
import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum';
import { DatabaseModule } from 'src/common/database/database.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { SocketModule } from '../socket/socket.module';
// ✅ THÊM: Import module integration để dùng được Manager
import { IntegrationModule } from '../integration/integration.module';
import { DeviceProvisioningService } from './services/device-provisioning.service';
import { DeviceControlService } from './services/device-control.service';

@Module({
    imports: [
        DatabaseModule,
        RedisModule,
        SocketModule,

        // 1. Giữ nguyên Queue điều khiển (Chiều đi)
        BullModule.registerQueue({
            name: APP_BULLMQ_QUEUES.DEVICE_CONTROL,
        }),
        IntegrationModule,
    ],
    controllers: [DeviceController],
    providers: [
        DeviceProvisioningService,
        DeviceControlService,
        DeviceControlProcessor,
    ],
})
export class DeviceModule {}
