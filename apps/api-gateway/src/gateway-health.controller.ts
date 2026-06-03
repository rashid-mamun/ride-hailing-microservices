import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import axios from 'axios';
import Redis from 'ioredis';
import { RabbitMqClient, createLogger } from '@ride-hailing/shared-utils';

@ApiTags('health')
@Controller()
export class GatewayHealthController {
    private readonly logger = createLogger('api-gateway');

    @Get('health')
    async health() {
        const checks: Record<string, boolean> = {};
        const services = {
            auth: process.env.AUTH_SERVICE_URL,
            ride: process.env.RIDE_SERVICE_URL,
            location: process.env.LOCATION_SERVICE_URL,
            pricing: process.env.PRICING_SERVICE_URL,
            payment: process.env.PAYMENT_SERVICE_URL,
        };
        await Promise.all(
            Object.entries(services).map(async ([name, url]) => {
                try {
                    await axios.get(`${url}/health`, { timeout: 1500 });
                    checks[name] = true;
                } catch {
                    checks[name] = false;
                }
            }),
        );
        try {
            const redis = new Redis(process.env.REDIS_URL || '');
            await redis.ping();
            await redis.quit();
            checks.redis = true;
        } catch {
            checks.redis = false;
        }
        try {
            await new RabbitMqClient(process.env.RABBITMQ_URL || '', this.logger).connect(1);
            checks.rabbitmq = true;
        } catch {
            checks.rabbitmq = false;
        }
        return {
            status: Object.values(checks).every(Boolean) ? 'ok' : 'degraded',
            service: 'api-gateway',
            timestamp: new Date().toISOString(),
            checks,
        };
    }
}
