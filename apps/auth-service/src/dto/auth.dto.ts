import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsBoolean,
    IsEmail,
    IsEnum,
    IsOptional,
    IsString,
    Matches,
    MinLength,
    ValidateIf,
} from 'class-validator';
import type { UserRole } from '@ride-hailing/shared-types';

const bdPhone = /^\+8801[3-9]\d{8}$/;
const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export class RegisterDto {
    @ApiProperty({
        example: 'rider@example.com',
        description: 'Unique email address. Stored in lowercase.',
    })
    @IsEmail()
    @Transform(({ value }) => String(value).toLowerCase())
    email!: string;

    @ApiProperty({
        example: 'StrongPass123',
        minLength: 8,
        description: 'Must include uppercase, lowercase and number.',
    })
    @MinLength(8)
    @Matches(strongPassword, { message: 'password must contain uppercase, lowercase and number' })
    password!: string;

    @ApiProperty({ example: 'John' })
    @IsString()
    firstName!: string;

    @ApiProperty({ example: 'Doe' })
    @IsString()
    lastName!: string;

    @ApiProperty({
        example: 'rider',
        enum: ['rider', 'driver', 'admin'],
        description: 'Self-registration supports rider or driver. Admin is rejected.',
    })
    @IsEnum(['rider', 'driver', 'admin'])
    role!: UserRole;

    @ApiPropertyOptional({
        example: '+8801712345678',
        description: 'Bangladesh phone number format.',
    })
    @IsOptional()
    @Matches(bdPhone, { message: 'phoneNumber must be a valid Bangladesh number' })
    phoneNumber?: string;

    @ApiPropertyOptional({ example: 'Toyota Axio', description: 'Required when role is driver.' })
    @ValidateIf((dto: RegisterDto) => dto.role === 'driver')
    @IsString()
    vehicleModel?: string;

    @ApiPropertyOptional({ example: 'DHA-1234', description: 'Required when role is driver.' })
    @ValidateIf((dto: RegisterDto) => dto.role === 'driver')
    @IsString()
    vehiclePlate?: string;
}

export class LoginDto {
    @ApiProperty({ example: 'rider@example.com' })
    @IsEmail()
    @Transform(({ value }) => String(value).toLowerCase())
    email!: string;

    @ApiProperty({ example: 'StrongPass123' })
    @IsString()
    password!: string;
}

export class RefreshDto {
    @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh' })
    @IsString()
    refreshToken!: string;
}

export class LogoutDto extends RefreshDto {}

export class UpdateProfileDto {
    @ApiPropertyOptional({ example: 'Jane' })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiPropertyOptional({ example: 'Doe' })
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiPropertyOptional({ example: '+8801712345678' })
    @IsOptional()
    @Matches(bdPhone)
    phoneNumber?: string;
}

export class AvailabilityDto {
    @ApiProperty({
        example: true,
        description: 'Whether the authenticated driver is accepting ride requests.',
    })
    @IsBoolean()
    isAvailable!: boolean;
}
