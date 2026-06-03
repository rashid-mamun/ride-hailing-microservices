import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { response } from '@ride-hailing/shared-utils';
import { NearbyDriversDto, UpdateLocationDto } from './dto/location.dto';
import { LocationService } from './location.service';

@ApiTags('locations')
@Controller(['api/locations', 'api/v1/locations'])
export class LocationController {
    constructor(private readonly locationService: LocationService) {}
    @ApiOperation({
        summary: 'Update driver location',
        description: 'Stores available driver position with Redis GEO and 30-second metadata TTL.',
    })
    @ApiParam({ name: 'driverId', example: '33333333-3333-4333-8333-333333333333' })
    @ApiOkResponse({
        description: 'Driver location updated.',
        schema: {
            example: {
                success: true,
                data: {
                    driverId: '33333333-3333-4333-8333-333333333333',
                    lat: 23.8103,
                    lng: 90.4125,
                    heading: 45.5,
                    speed: 32.5,
                    rideId: '11111111-1111-4111-8111-111111111111',
                },
            },
        },
    })
    @Post('drivers/:driverId')
    async update(@Param('driverId') driverId: string, @Body() dto: UpdateLocationDto) {
        return response.success(await this.locationService.updateDriverLocation(driverId, dto));
    }
    @ApiOperation({
        summary: 'Find nearby available drivers',
        description:
            'Uses Redis GEOSEARCH and returns active drivers whose metadata TTL has not expired.',
    })
    @ApiOkResponse({
        description: 'Nearby drivers ordered by distance.',
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
    async nearby(@Query() query: NearbyDriversDto) {
        return response.success(await this.locationService.nearby(query));
    }
}
