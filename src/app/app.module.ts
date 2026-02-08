import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { CommonModule } from 'src/common/common.module';
import { UserModule } from 'src/modules/user/user.module';
import { WorkerModule } from 'src/workers/worker.module';
import { MCPModule } from '../common/mcp/mcp.module';

import { HealthController } from './controllers/health.controller';
import { TestModule } from 'src/modules/test/test.module';
import { MqttModule } from 'src/common/mqtt/mqtt.module';
import { ProvisioningModule } from 'src/modules/provisioning/provisioning.module';
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
        UserModule,
        TestModule,
        MqttModule,
        ProvisioningModule

    ],
    controllers: [HealthController],
})
export class AppModule {}
