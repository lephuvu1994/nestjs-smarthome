import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

import { SocketGateway } from './gateways/socket.gateway';
import { SocketService } from './services/socket.service';
import { HelperModule } from 'src/common/helper/helper.module'; // Để dùng các helper nếu cần

@Global() // Quan trọng: Để SocketService dùng được ở mọi nơi mà không cần import lại
@Module({
    imports: [
        ConfigModule,
        JwtModule.register({}), // Import JwtModule để verify token
        HelperModule
    ],
    providers: [SocketGateway, SocketService],
    exports: [SocketService], // Export service để module khác bắn noti
})
export class SocketModule {}
