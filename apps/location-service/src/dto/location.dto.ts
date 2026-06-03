import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateLocationDto {
    @ApiProperty({ example: 23.8103 })
    @Type(() => Number)
    @IsLatitude()
    lat!: number;
    @ApiProperty({ example: 90.4125 })
    @Type(() => Number)
    @IsLongitude()
    lng!: number;
    @ApiProperty({ example: 45.5, minimum: 0, maximum: 360 })
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(360)
    heading!: number;
    @ApiProperty({ example: 32.5, minimum: 0, description: 'Current speed in km/h.' })
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    speed!: number;
    @ApiPropertyOptional({
        example: '11111111-1111-4111-8111-111111111111',
        description: 'Active ride room to broadcast driver updates.',
    })
    @IsOptional()
    rideId?: string;
}

export class NearbyDriversDto {
    @ApiProperty({ example: 23.8103 })
    @Type(() => Number)
    @IsLatitude()
    lat!: number;
    @ApiProperty({ example: 90.4125 })
    @Type(() => Number)
    @IsLongitude()
    lng!: number;
    @ApiPropertyOptional({ example: 5, default: 5 })
    @Type(() => Number)
    @IsNumber()
    radiusKm = 5;
    @ApiPropertyOptional({ example: 10, default: 10 })
    @Type(() => Number)
    @IsNumber()
    limit = 10;
}
