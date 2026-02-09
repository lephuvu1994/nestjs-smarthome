// src/modules/device/device.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { DeviceController } from './controllers/device.controller';
import { DeviceService } from './services/device.service';
import { DeviceControlProcessor } from './processors/device-control.processor';
import { APP_BULLMQ_QUEUES } from 'src/app/enums/app.enum';
import { DatabaseModule } from 'src/common/database/database.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { SocketModule } from '../socket/socket.module';

@Module({
    imports: [
        DatabaseModule,
        RedisModule,
        SocketModule,
        // 1. Đăng ký Queue điều khiển
        BullModule.registerQueue({
            name: APP_BULLMQ_QUEUES.DEVICE_CONTROL,
        }),
        // 2. Kết nối MQTT Microservice
        ClientsModule.register([
            {
                name: 'MQTT_SERVICE',
                transport: Transport.MQTT,
                options: {
                    url: process.env.MQTT_URL,
                    // Serializer thô để Chip dễ parse cJSON
                    serializer: {
                        serialize: value => JSON.stringify(value.data),
                    },
                },
            },
        ]),
    ],
    controllers: [DeviceController],
    providers: [DeviceService, DeviceControlProcessor],
})
export class DeviceModule {}
