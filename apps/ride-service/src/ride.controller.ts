import { Body, Controller, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiHeader,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import { JwtUser, response, Roles, RolesGuard } from '@ride-hailing/shared-utils';
import type { JwtPayload } from '@ride-hailing/shared-types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RideService } from './ride.service';
import { CancelRideDto, CompleteRideDto, MatchRideDto, RequestRideDto } from './dto/ride.dto';

const rideExample = {
    id: '11111111-1111-4111-8111-111111111111',
    riderId: '22222222-2222-4222-8222-222222222222',
    driverId: '33333333-3333-4333-8333-333333333333',
    status: 'driver_matched',
    pickupAddress: 'Gulshan 1, Dhaka',
    pickupLat: '23.8103000',
    pickupLng: '90.4125000',
    dropoffAddress: 'Dhanmondi 27, Dhaka',
    dropoffLat: '23.7461000',
    dropoffLng: '90.3742000',
    estimatedFare: '185.00',
    estimatedDistanceKm: '8.10',
    estimatedDurationMinutes: 17,
    requestedAt: '2026-06-03T01:00:00.000Z',
    matchedAt: '2026-06-03T01:00:03.000Z',
};

@ApiBearerAuth()
@ApiTags('rides')
@UseGuards(JwtAuthGuard)
@Controller(['api/rides', 'api/v1/rides'])
export class RideController {
    constructor(private readonly rideService: RideService) {}
    @ApiOperation({
        summary: 'Request a ride',
        description:
            'Rider-only. Uses pricing-service for fare estimate and location-service for best nearby driver match. Supports X-Idempotency-Key.',
    })
    @ApiHeader({
        name: 'X-Idempotency-Key',
        required: false,
        example: 'ride-request-20260603-0001',
    })
    @ApiCreatedResponse({
        description: 'Ride created. May already be driver_matched if a nearby driver is found.',
        schema: { example: { success: true, data: rideExample } },
    })
    @ApiForbiddenResponse({
        description: 'Only riders can request rides.',
        schema: { example: { success: false, error: 'insufficient role' } },
    })
    @Roles('rider')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post()
    async request(
        @JwtUser() user: JwtPayload,
        @Body() dto: RequestRideDto,
        @Headers('x-idempotency-key') key?: string,
    ) {
        return response.success(await this.rideService.requestRide(user, dto, key));
    }
    @ApiOperation({
        summary: 'List rides',
        description: 'Riders see own rides; admins see all rides.',
    })
    @ApiOkResponse({
        description: 'Ride list.',
        schema: { example: { success: true, data: [rideExample] } },
    })
    @Get()
    async list(@JwtUser() user: JwtPayload) {
        return response.success(await this.rideService.list(user));
    }
    @ApiOperation({ summary: 'Get ride details' })
    @ApiParam({ name: 'id', example: '11111111-1111-4111-8111-111111111111' })
    @ApiOkResponse({
        description: 'Ride details.',
        schema: { example: { success: true, data: rideExample } },
    })
    @Get(':id')
    async get(@Param('id') id: string, @JwtUser() user: JwtPayload) {
        return response.success(await this.rideService.get(id, user));
    }
    @ApiOperation({ summary: 'Driver accepts a requested ride' })
    @ApiParam({ name: 'id', example: '11111111-1111-4111-8111-111111111111' })
    @ApiOkResponse({
        description: 'Ride matched to driver.',
        schema: { example: { success: true, data: { ...rideExample, status: 'driver_matched' } } },
    })
    @ApiBadRequestResponse({
        description: 'Invalid transition.',
        schema: { example: { success: false, error: 'cannot transition ride from in_progress' } },
    })
    @Roles('driver')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch(':id/match')
    async match(@Param('id') id: string, @Body() dto: MatchRideDto, @JwtUser() user: JwtPayload) {
        return response.success(await this.rideService.match(id, dto, user));
    }
    @ApiOperation({ summary: 'Driver marks arrival at pickup' })
    @ApiOkResponse({
        description: 'Ride marked as driver_arrived.',
        schema: { example: { success: true, data: { ...rideExample, status: 'driver_arrived' } } },
    })
    @Roles('driver')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch(':id/arrive')
    async arrive(@Param('id') id: string, @JwtUser() user: JwtPayload) {
        return response.success(await this.rideService.arrive(id, user));
    }
    @ApiOperation({ summary: 'Start ride' })
    @ApiOkResponse({
        description: 'Ride is now in progress.',
        schema: {
            example: {
                success: true,
                data: {
                    ...rideExample,
                    status: 'in_progress',
                    startedAt: '2026-06-03T01:05:00.000Z',
                },
            },
        },
    })
    @Roles('driver')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch(':id/start')
    async start(@Param('id') id: string, @JwtUser() user: JwtPayload) {
        return response.success(await this.rideService.start(id, user));
    }
    @ApiOperation({
        summary: 'Complete ride',
        description:
            'Driver-only. Inserts RIDE_COMPLETED outbox event, consumed by payment-service.',
    })
    @ApiOkResponse({
        description: 'Ride completed.',
        schema: {
            example: {
                success: true,
                data: {
                    ...rideExample,
                    status: 'completed',
                    finalFare: '250.00',
                    completedAt: '2026-06-03T01:25:00.000Z',
                },
            },
        },
    })
    @Roles('driver')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch(':id/complete')
    async complete(
        @Param('id') id: string,
        @Body() dto: CompleteRideDto,
        @JwtUser() user: JwtPayload,
    ) {
        return response.success(await this.rideService.complete(id, dto, user));
    }
    @ApiOperation({ summary: 'Cancel ride' })
    @ApiOkResponse({
        description: 'Ride cancelled.',
        schema: {
            example: {
                success: true,
                data: {
                    ...rideExample,
                    status: 'cancelled',
                    cancellationReason: 'changed_mind',
                    cancelledBy: 'rider',
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Cannot cancel completed or already cancelled rides.',
        schema: { example: { success: false, error: 'completed ride cannot be cancelled' } },
    })
    @Patch(':id/cancel')
    async cancel(@Param('id') id: string, @Body() dto: CancelRideDto, @JwtUser() user: JwtPayload) {
        return response.success(await this.rideService.cancel(id, dto, user));
    }
}
