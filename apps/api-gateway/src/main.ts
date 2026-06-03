import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
    GlobalExceptionFilter,
    RequestLoggingInterceptor,
    createLogger,
    initTracing,
} from '@ride-hailing/shared-utils';
import { AppModule } from './app.module';

initTracing(process.env.OTEL_SERVICE_NAME || 'api-gateway');

async function bootstrap() {
    const logger = createLogger('api-gateway');
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    app.useGlobalFilters(new GlobalExceptionFilter(logger));
    app.useGlobalInterceptors(new RequestLoggingInterceptor(logger));
    app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    const config = new DocumentBuilder()
        .setTitle('api-gateway')
        .setDescription('Ride hailing api-gateway API')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
    const port = Number(process.env.API_GATEWAY_PORT || 3000);
    await app.listen(port, '0.0.0.0');
    logger.info('service_started', { service: 'api-gateway', port });
}

void bootstrap();
