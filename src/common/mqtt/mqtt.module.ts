import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

// 1. Đây chính là cái tên Token mà bên Service sẽ @Inject()
export const MQTT_SERVICE = 'MQTT_SERVICE';

@Global() // <--- Quan trọng: Đặt là Global để dùng ở mọi nơi không cần import lại
@Module({
    imports: [
        ClientsModule.register([
            {
                name: MQTT_SERVICE,
                transport: Transport.MQTT,
                options: {
                    // Logic lấy URL: Ưu tiên biến MQTT_URL, nếu không có thì tự ghép từ Host/Port
                    url:
                        process.env.MQTT_URL ||
                        `mqtt://${process.env.MQTT_HOST || '127.0.0.1'}:${process.env.MQTT_PORT || 1883}`,
                    username: process.env.MQTT_USER,
                    password: process.env.MQTT_PASS,
                    serializer: {
                        serialize(value: any) {
                            return JSON.stringify(value.data);
                        },
                    },
                },
            },
        ]),
    ],
    exports: [ClientsModule], // Export ra để các module khác xài ké
})
export class MqttModule {}
