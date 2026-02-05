import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Transport } from '@nestjs/microservices'; // <--- 1. Import thêm
import { useContainer } from 'class-validator';
import compression from 'compression';
import express from 'express';
import { Logger } from 'nestjs-pino';
import helmet, { HelmetOptions } from 'helmet';

import { getMCPHelmetConfig } from './common/mcp/mcp.utils';
import { AppModule } from './app/app.module';
import { APP_ENVIRONMENT } from './app/enums/app.enum';
import setupSwagger from './swagger';

async function bootstrap(): Promise<void> {
    const server = express();
    let app: any;

    try {
        // Create app
        app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
            bufferLogs: true,
        });

        const config = app.get(ConfigService);
        const logger = app.get(Logger);
        const env = config.get('app.env');
        const host = config.getOrThrow('app.http.host');
        const port = config.getOrThrow('app.http.port');

        // Middleware
        app.use(helmet(getMCPHelmetConfig() as HelmetOptions)); // Helmet with MCP playground support
        app.use(compression());
        app.useLogger(logger);
        app.enableCors(config.get('app.cors'));

        // Global settings
        app.useGlobalPipes(
            new ValidationPipe({
                transform: true,
                whitelist: true,
                forbidNonWhitelisted: true,
            })
        );

        // Enable versioning (MCP routes use VERSION_NEUTRAL to bypass this)
        app.enableVersioning({
            type: VersioningType.URI,
            defaultVersion: '1',
        });

        useContainer(app.select(AppModule), { fallbackOnErrors: true });

        // --- 2. Cấu hình MQTT Microservice (Hybrid App) ---
        // Lấy config từ ConfigService hoặc fallback về process.env/mặc định
        const mqttUser = config.get('mqtt.user') || process.env.MQTT_USER;
        const mqttPass = config.get('mqtt.password') || process.env.MQTT_PASS;
        // Nếu URL trong .env có dạng full (mqtt://localhost:1883) thì ưu tiên dùng, nếu không thì tự ghép
        const mqttUrl = process.env.MQTT_URL;

        app.connectMicroservice({
            transport: Transport.MQTT,
            options: {
                url: mqttUrl,
                username: mqttUser,
                password: mqttPass,
                // Client ID (Optional - nên có để broker dễ quản lý)
                clientId:
                    'eec-server-smarthome' +
                    Math.random().toString(16).substr(2, 8),
            },
        });

        // Swagger for non-production
        if (env !== APP_ENVIRONMENT.PRODUCTION) {
            setupSwagger(app);
        }

        // --- 3. Start cả HTTP và Microservices ---
        logger.log('Connecting to MQTT Broker...'); // <--- Thêm dòng này
        await app.startAllMicroservices();
        logger.log('MQTT Broker Connected!');
        await app.listen(port, host); // Khởi động HTTP Server

        // Logging output
        const appUrl = await app.getUrl();
        logger.log(`Server running on: ${appUrl}`);
        logger.log(`MQTT Microservice is connected to: ${mqttUrl}`);

        // Graceful shutdown (only in production - watch mode handles this differently)
        if (env === APP_ENVIRONMENT.PRODUCTION) {
            const gracefulShutdown = async (signal: string) => {
                logger.log(`Received ${signal}, shutting down gracefully...`);
                await app.close();
                process.exit(0);
            };

            process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
            process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        } else {
            // In development, enable shutdown hooks for proper cleanup
            app.enableShutdownHooks();
        }
    } catch (error) {
        console.error('Server failed to start:', error);
        if (app) await app.close();
        process.exit(1);
    }
}

bootstrap();
