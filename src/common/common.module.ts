import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-ioredis';

import { AuthModule } from './auth/auth.module';
import configs from './config';
import { DatabaseModule } from './database/database.module';
import { CustomLoggerModule } from './logger/logger.module';
import { RequestModule } from './request/request.module';
import { ResponseModule } from './response/response.module';

@Module({
    imports: [
        // Configuration - Global
        ConfigModule.forRoot({
            load: configs,
            isGlobal: true,
            cache: true,
            envFilePath: ['.env'],
            expandVariables: true,
        }),

        // Core Infrastructure
        DatabaseModule,
        AuthModule,

        // Cross-cutting Concerns
        CustomLoggerModule,
        RequestModule,
        ResponseModule,

        // Caching - Redis
        CacheModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                isGlobal: true,
                store: redisStore,
                host: configService.get('redis.host'),
                port: configService.get('redis.port'),
                password: configService.get('redis.password'),
                tls: configService.get('redis.tls'),
                ttl: 5000,
            }),
            inject: [ConfigService],
        }),
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                connection: {
                    host: configService.get('redis.host'),
                    port: Number(configService.get('redis.port')),
                    password: configService.get('redis.password'),
                    // BullMQ khuyến khích thêm maxRetriesPerRequest: null
                    // để đảm bảo worker không bị ngắt kết nối khi xử lý job nặng
                    maxRetriesPerRequest: null,
                },
            }),
            inject: [ConfigService],
        }),
    ],
    exports: [DatabaseModule],
})
export class CommonModule {}
