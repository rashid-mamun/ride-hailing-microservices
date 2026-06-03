import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { ServiceHealthResponse } from '@ride-hailing/shared-types';

@ApiTags('health')
@Controller()
export class HealthController {
    @Get('health')
    health(): ServiceHealthResponse {
        return { status: 'ok', service: 'pricing-service', timestamp: new Date().toISOString() };
    }
}
