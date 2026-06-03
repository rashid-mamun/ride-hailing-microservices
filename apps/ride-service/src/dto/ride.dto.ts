import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsEnum,
    IsLatitude,
    IsLongitude,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
} from 'class-validator';

export class RequestRideDto {
    @ApiProperty({ example: 23.8103, description: 'Pickup latitude.' })
    @Type(() => Number)
    @IsLatitude()
    pickupLat!: number;

    @ApiProperty({ example: 90.4125, description: 'Pickup longitude.' })
    @Type(() => Number)
    @IsLongitude()
    pickupLng!: number;

    @ApiProperty({ example: 'Gulshan 1, Dhaka' })
    @IsString()
    pickupAddress!: string;

    @ApiProperty({ example: 23.7461, description: 'Dropoff latitude.' })
    @Type(() => Number)
    @IsLatitude()
    dropoffLat!: number;

    @ApiProperty({ example: 90.3742, description: 'Dropoff longitude.' })
    @Type(() => Number)
    @IsLongitude()
    dropoffLng!: number;

    @ApiProperty({ example: 'Dhanmondi 27, Dhaka' })
    @IsString()
    dropoffAddress!: string;
}

export class MatchRideDto {
    @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
    @IsUUID()
    driverId!: string;

    @ApiProperty({ example: 'Jane Driver' })
    @IsString()
    driverName!: string;

    @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 60 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(60)
    estimatedArrivalMinutes = 5;
}

export class CompleteRideDto {
    @ApiProperty({ example: 250 })
    @Type(() => Number)
    @IsNumber()
    finalFare!: number;

    @ApiProperty({ example: 9.5 })
    @Type(() => Number)
    @IsNumber()
    distanceKm!: number;

    @ApiProperty({ example: 25 })
    @Type(() => Number)
    @IsNumber()
    durationMinutes!: number;
}

export class CancelRideDto {
    @ApiProperty({ example: 'changed_mind' })
    @IsString()
    reason!: string;

    @ApiProperty({ example: 'rider', enum: ['rider', 'driver', 'system'] })
    @IsEnum(['rider', 'driver', 'system'])
    cancelledBy!: 'rider' | 'driver' | 'system';
}
