import { Controller, Get, Patch, Post, Put } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiCreatedResponse,
    ApiHeader,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';

const tokenEnvelope = {
    success: true,
    data: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
        user: {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'rider@example.com',
            role: 'rider',
            firstName: 'John',
        },
    },
};

const rideEnvelope = {
    success: true,
    data: {
        id: '22222222-2222-4222-8222-222222222222',
        status: 'driver_matched',
        riderId: '11111111-1111-4111-8111-111111111111',
        driverId: '33333333-3333-4333-8333-333333333333',
        estimatedFare: '185.00',
        pickupAddress: 'Gulshan 1, Dhaka',
        dropoffAddress: 'Dhanmondi 27, Dhaka',
    },
};

@ApiTags('gateway proxied auth')
@Controller(['api/auth', 'api/v1/auth'])
export class GatewayAuthDocsController {
    @ApiOperation({ summary: 'Proxy: register rider or driver' })
    @ApiBody({
        schema: {
            example: {
                email: 'rider@example.com',
                password: 'StrongPass123',
                firstName: 'John',
                lastName: 'Doe',
                role: 'rider',
                phoneNumber: '+8801712345678',
            },
        },
    })
    @ApiCreatedResponse({ schema: { example: tokenEnvelope } })
    @Post('register')
    register() {
        return undefined;
    }

    @ApiOperation({ summary: 'Proxy: login' })
    @ApiBody({ schema: { example: { email: 'rider@example.com', password: 'StrongPass123' } } })
    @ApiCreatedResponse({ schema: { example: tokenEnvelope } })
    @Post('login')
    login() {
        return undefined;
    }

    @ApiOperation({ summary: 'Proxy: refresh token rotation' })
    @ApiBody({
        schema: { example: { refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh' } },
    })
    @ApiCreatedResponse({ schema: { example: tokenEnvelope } })
    @Post('refresh')
    refresh() {
        return undefined;
    }

    @ApiBearerAuth()
    @ApiOperation({ summary: 'Proxy: current profile' })
    @ApiOkResponse({
        schema: {
            example: {
                success: true,
                data: {
                    id: '11111111-1111-4111-8111-111111111111',
                    email: 'rider@example.com',
                    role: 'rider',
                },
            },
        },
    })
    @Get('me')
    me() {
        return undefined;
    }

    @ApiBearerAuth()
    @ApiOperation({ summary: 'Proxy: update driver availability' })
    @ApiBody({ schema: { example: { isAvailable: true } } })
    @ApiOkResponse({ schema: { example: { success: true, data: { isAvailable: true } } } })
    @Put('drivers/availability')
    availability() {
        return undefined;
    }
}

@ApiBearerAuth()
@ApiTags('gateway proxied rides')
@Controller(['api/rides', 'api/v1/rides'])
export class GatewayRideDocsController {
    @ApiOperation({ summary: 'Proxy: request ride' })
    @ApiHeader({
        name: 'X-Idempotency-Key',
        required: false,
        example: 'ride-request-20260603-0001',
    })
    @ApiBody({
        schema: {
            example: {
                pickupLat: 23.8103,
                pickupLng: 90.4125,
                pickupAddress: 'Gulshan 1, Dhaka',
                dropoffLat: 23.7461,
                dropoffLng: 90.3742,
                dropoffAddress: 'Dhanmondi 27, Dhaka',
            },
        },
    })
    @ApiCreatedResponse({ schema: { example: rideEnvelope } })
    @Post()
    requestRide() {
        return undefined;
    }

    @ApiOperation({ summary: 'Proxy: list rides' })
    @ApiOkResponse({ schema: { example: { success: true, data: [rideEnvelope.data] } } })
    @Get()
    listRides() {
        return undefined;
    }

    @ApiOperation({ summary: 'Proxy: get ride details' })
    @ApiParam({ name: 'id', example: '22222222-2222-4222-8222-222222222222' })
    @ApiOkResponse({ schema: { example: rideEnvelope } })
    @Get(':id')
    getRide() {
        return undefined;
    }

    @ApiOperation({ summary: 'Proxy: driver accepts ride' })
    @ApiBody({
        schema: {
            example: {
                driverId: '33333333-3333-4333-8333-333333333333',
                driverName: 'Jane Driver',
                estimatedArrivalMinutes: 5,
            },
        },
    })
    @ApiOkResponse({ schema: { example: rideEnvelope } })
    @Patch(':id/match')
    matchRide() {
        return undefined;
    }

    @ApiOperation({ summary: 'Proxy: driver arrives at pickup' })
    @ApiOkResponse({
        schema: {
            example: {
                success: true,
                data: { ...rideEnvelope.data, status: 'driver_arrived' },
            },
        },
    })
    @Patch(':id/arrive')
    arriveRide() {
        return undefined;
    }

    @ApiOperation({ summary: 'Proxy: start ride' })
    @ApiOkResponse({
        schema: {
            example: {
                success: true,
                data: { ...rideEnvelope.data, status: 'in_progress' },
            },
        },
    })
    @Patch(':id/start')
    startRide() {
        return undefined;
    }

    @ApiOperation({ summary: 'Proxy: complete ride' })
    @ApiBody({ schema: { example: { finalFare: 250, distanceKm: 9.5, durationMinutes: 25 } } })
    @ApiOkResponse({
        schema: {
            example: {
                success: true,
                data: { ...rideEnvelope.data, status: 'completed', finalFare: '250.00' },
            },
        },
    })
    @Patch(':id/complete')
    completeRide() {
        return undefined;
    }
}

@ApiTags('gateway proxied pricing')
@Controller(['api/pricing', 'api/v1/pricing'])
export class GatewayPricingDocsController {
    @ApiOperation({ summary: 'Proxy: estimate fare' })
    @ApiQuery({ name: 'pickupLat', example: 23.8103 })
    @ApiQuery({ name: 'pickupLng', example: 90.4125 })
    @ApiQuery({ name: 'dropoffLat', example: 23.7461 })
    @ApiQuery({ name: 'dropoffLng', example: 90.3742 })
    @ApiOkResponse({
        schema: {
            example: {
                success: true,
                data: {
                    estimatedFare: 185,
                    breakdown: {
                        baseFare: 30,
                        distanceKm: 8.1,
                        estimatedMinutes: 17,
                        surgeMultiplier: 1,
                    },
                    currency: 'BDT',
                },
            },
        },
    })
    @Get('estimate')
    estimate() {
        return undefined;
    }
}

@ApiTags('gateway proxied locations')
@Controller(['api/locations', 'api/v1/locations'])
export class GatewayLocationDocsController {
    @ApiOperation({ summary: 'Proxy: update driver location' })
    @ApiBody({
        schema: {
            example: {
                lat: 23.8103,
                lng: 90.4125,
                heading: 45.5,
                speed: 32.5,
                rideId: '22222222-2222-4222-8222-222222222222',
            },
        },
    })
    @ApiOkResponse({
        schema: {
            example: {
                success: true,
                data: {
                    driverId: '33333333-3333-4333-8333-333333333333',
                    lat: 23.8103,
                    lng: 90.4125,
                    heading: 45.5,
                    speed: 32.5,
                },
            },
        },
    })
    @Post('drivers/:driverId')
    updateDriver() {
        return undefined;
    }

    @ApiOperation({ summary: 'Proxy: find nearby drivers' })
    @ApiQuery({ name: 'lat', example: 23.8103 })
    @ApiQuery({ name: 'lng', example: 90.4125 })
    @ApiQuery({ name: 'radiusKm', required: false, example: 5 })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiOkResponse({
        schema: {
            example: {
                success: true,
                data: [
                    {
                        driverId: '33333333-3333-4333-8333-333333333333',
                        lat: 23.8103,
                        lng: 90.4125,
                        distanceKm: 1.23,
                        heading: 45,
                        speed: 30,
                    },
                ],
            },
        },
    })
    @Get('drivers/nearby')
    nearby() {
        return undefined;
    }
}
