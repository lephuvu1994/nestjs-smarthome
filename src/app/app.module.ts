import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { CommonModule } from 'src/common/common.module';
import { UserModule } from 'src/modules/user/user.module';
import { WorkerModule } from 'src/workers/worker.module';
import { MCPModule } from '../common/mcp/mcp.module';

import { HealthController } from './controllers/health.controller';
import { TestModule } from 'src/modules/test/test.module';
import { MqttModule } from 'src/common/mqtt/mqtt.module';
import { SocketModule } from 'src/modules/socket/socket.module';
import { AdminModule } from 'src/modules/admin/admin.module';
import { DeviceModule } from 'src/modules/device/device.module';
@Module({
    imports: [
        // Shared Common Services
        CommonModule,

        // MCP Integration
        MCPModule,

        // Background Processing
        WorkerModule,
        AdminModule,

        // Health Check
        TerminusModule,

        // Feature Modules
        UserModule,
        TestModule,
        MqttModule,
        SocketModule,
        DeviceModule,
    ],
    controllers: [HealthController],
})
export class AppModule {}
