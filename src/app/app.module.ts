import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { CommonModule } from 'src/common/common.module';
import { PostModule } from 'src/modules/post/post.module';
import { UserModule } from 'src/modules/user/user.module';
import { WorkerModule } from 'src/workers/worker.module';
import { MCPModule } from '../common/mcp/mcp.module';

import { HealthController } from './controllers/health.controller';
import { TestModule } from 'src/modules/test/test.module';
import { MqttModule } from 'src/common/mqtt/mqtt.module';
@Module({
    imports: [
        // Shared Common Services
        CommonModule,

        // MCP Integration
        MCPModule,

        // Background Processing
        WorkerModule,

        // Health Check
        TerminusModule,

        // Feature Modules
        PostModule,
        UserModule,
        TestModule,
        MqttModule,
    ],
    controllers: [HealthController],
})
export class AppModule {}
