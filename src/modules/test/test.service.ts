import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MQTT_SERVICE } from '../../common/mqtt/mqtt.module'; // Import token từ module MQTT chung

@Injectable()
export class TestService {
    constructor(
        // Inject Client MQTT vào để dùng
        @Inject(MQTT_SERVICE) private readonly mqttClient: ClientProxy
    ) {}

    async sayHello() {
        const payload = {
            state: 'OPEN',
        };
        // --- Gửi tin nhắn MQTT (Publish) ---
        // Topic: 'test/hello'
        // emit: Gửi đi mà không cần đợi phản hồi (Fire-and-forget)
        this.mqttClient.emit('BKTech/1001/congtaccuacuon/set', payload);
        console.log('Đã bắn tin nhắn sang MQTT topic: test/hello');

        // --- Trả về kết quả HTTP ---
        return {
            message: 'Hello World',
            action: 'Published to MQTT',
            data_sent: payload,
        };
    }
}
