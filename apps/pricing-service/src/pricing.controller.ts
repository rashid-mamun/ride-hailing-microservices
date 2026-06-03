import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { JwtUser, response, Roles, RolesGuard } from '@ride-hailing/shared-utils';
import type { JwtPayload } from '@ride-hailing/shared-types';
import { CreatePricingRuleDto, EstimateFareDto } from './pricing.dto';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const fareEstimateExample = {
    success: true,
    data: {
        estimatedFare: 185,
        breakdown: {
            baseFare: 30,
            distanceFare: 97.2,
            timeFare: 25.5,
            surgeMultiplier: 1,
            distanceKm: 8.1,
            estimatedMinutes: 17,
        },
        currency: 'BDT',
    },
};

const pricingRuleExample = {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Default Dhaka Rule',
    baseFare: '30.00',
    perKmRate: '12.00',
    perMinuteRate: '1.50',
    minimumFare: '50.00',
    surgeMultiplier: '1.00',
    isActive: true,
};

@ApiTags('pricing')
@Controller(['api/pricing', 'api/v1/pricing'])
export class PricingController {
    constructor(private readonly pricingService: PricingService) {}
    @ApiOperation({
        summary: 'Estimate ride fare',
        description:
            'Calculates Haversine distance, applies active pricing rule and surge multiplier, then caches the result for two minutes.',
    })
    @ApiOkResponse({
        description: 'Fare estimate with calculation breakdown.',
        schema: { example: fareEstimateExample },
    })
    @Get('estimate')
    async estimate(@Query() query: EstimateFareDto) {
        return response.success(await this.pricingService.estimate(query));
    }
    @ApiOperation({ summary: 'List pricing rules', description: 'Admin-only endpoint.' })
    @ApiOkResponse({
        description: 'Pricing rules.',
        schema: { example: { success: true, data: [pricingRuleExample] } },
    })
    @ApiForbiddenResponse({
        description: 'Admin role required.',
        schema: { example: { success: false, error: 'insufficient role' } },
    })
    @ApiBearerAuth()
    @Roles('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('rules')
    async rules(@JwtUser() user: JwtPayload) {
        return response.success(await this.pricingService.listRules(user));
    }
    @ApiOperation({
        summary: 'Create pricing rule',
        description: 'Admin-only endpoint for defining fare rules.',
    })
    @ApiCreatedResponse({
        description: 'Pricing rule created.',
        schema: {
            example: {
                success: true,
                data: {
                    ...pricingRuleExample,
                    name: 'Dhaka Peak Hour Rule',
                    surgeMultiplier: '1.25',
                },
            },
        },
    })
    @ApiBearerAuth()
    @Roles('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post('rules')
    async create(@JwtUser() user: JwtPayload, @Body() dto: CreatePricingRuleDto) {
        return response.success(await this.pricingService.createRule(user, dto));
    }
}
