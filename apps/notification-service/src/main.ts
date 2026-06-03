import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
    GlobalExceptionFilter,
    RequestLoggingInterceptor,
    createLogger,
    initTracing,
} from '@ride-hailing/shared-utils';
import { AppModule } from './app.module';

initTracing(process.env.OTEL_SERVICE_NAME || 'notification-service');

async function bootstrap() {
    const logger = createLogger('notification-service');
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    app.useGlobalFilters(new GlobalExceptionFilter(logger));
    app.useGlobalInterceptors(new RequestLoggingInterceptor(logger));
    app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    const port = Number(process.env.NOTIFICATION_SERVICE_PORT || 3005);
    await app.listen(port, '0.0.0.0');
    logger.info('service_started', { service: 'notification-service', port });
}

void bootstrap();
