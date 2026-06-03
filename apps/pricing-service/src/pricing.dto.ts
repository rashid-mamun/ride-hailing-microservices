import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsLatitude,
    IsLongitude,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';

export class EstimateFareDto {
    @ApiProperty({ example: 23.8103 })
    @Type(() => Number)
    @IsLatitude()
    pickupLat!: number;
    @ApiProperty({ example: 90.4125 })
    @Type(() => Number)
    @IsLongitude()
    pickupLng!: number;
    @ApiProperty({ example: 23.7461 })
    @Type(() => Number)
    @IsLatitude()
    dropoffLat!: number;
    @ApiProperty({ example: 90.3742 })
    @Type(() => Number)
    @IsLongitude()
    dropoffLng!: number;
}

export class CreatePricingRuleDto {
    @ApiProperty({ example: 'Dhaka Peak Hour Rule' })
    @IsString()
    name!: string;
    @ApiProperty({ example: 30, minimum: 0 })
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    baseFare!: number;
    @ApiProperty({ example: 12, minimum: 0 })
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    perKmRate!: number;
    @ApiProperty({ example: 1.5, minimum: 0 })
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    perMinuteRate!: number;
    @ApiProperty({ example: 50, minimum: 0 })
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minimumFare!: number;
    @ApiProperty({ example: 1.25, minimum: 1 })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    surgeMultiplier!: number;
    @ApiPropertyOptional({ example: true, default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
