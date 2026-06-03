import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import Redis from 'ioredis';
import { validationSchema } from './config';
import { GatewayHealthController } from './gateway-health.controller';
import { AuthRateLimitMiddleware } from './auth-rate-limit.middleware';
import { JwtMiddleware } from './jwt.middleware';
import { ProxyMiddleware } from './proxy.middleware';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import {
    GatewayAuthDocsController,
    GatewayLocationDocsController,
    GatewayPricingDocsController,
    GatewayRideDocsController,
} from './swagger-proxy.controller';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, validationSchema }),
        ThrottlerModule.forRootAsync({
            useFactory: () => ({
                throttlers: [{ name: 'default', ttl: seconds(60), limit: 100 }],
                storage: new RedisThrottlerStorage(
                    new Redis(process.env.REDIS_URL || 'redis://localhost:6379'),
                ),
            }),
        }),
    ],
    controllers: [
        GatewayHealthController,
        GatewayAuthDocsController,
        GatewayRideDocsController,
        GatewayPricingDocsController,
        GatewayLocationDocsController,
    ],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(AuthRateLimitMiddleware, JwtMiddleware, ProxyMiddleware).forRoutes('*');
    }
}
