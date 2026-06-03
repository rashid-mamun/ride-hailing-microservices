import { Body, Controller, Get, Patch, Post, Put, UseGuards } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiConflictResponse,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { response, JwtUser, Roles, RolesGuard } from '@ride-hailing/shared-utils';
import type { JwtPayload } from '@ride-hailing/shared-types';
import { AuthService } from './auth.service';
import {
    AvailabilityDto,
    LoginDto,
    LogoutDto,
    RefreshDto,
    RegisterDto,
    UpdateProfileDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

const authTokensExample = {
    success: true,
    data: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
        user: {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'rider@example.com',
            role: 'rider',
            firstName: 'John',
            lastName: 'Doe',
            phoneNumber: '+8801712345678',
        },
    },
};

const validationErrorExample = {
    success: false,
    error: 'password must contain uppercase, lowercase and number',
};
const unauthorizedExample = { success: false, error: 'invalid credentials' };

@ApiTags('auth')
@Controller(['api/auth', 'api/v1/auth'])
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @ApiOperation({
        summary: 'Register a rider or driver',
        description:
            'Drivers must include vehicleModel and vehiclePlate. Admin self-registration is rejected.',
    })
    @ApiCreatedResponse({
        description: 'User registered and tokens issued.',
        schema: { example: authTokensExample },
    })
    @ApiBadRequestResponse({
        description: 'Invalid request body.',
        schema: { example: validationErrorExample },
    })
    @ApiConflictResponse({
        description: 'Email or phone already exists.',
        schema: { example: { success: false, error: 'email or phone number already exists' } },
    })
    @Post('register')
    async register(@Body() dto: RegisterDto) {
        return response.success(await this.authService.register(dto));
    }

    @ApiOperation({ summary: 'Login with email and password' })
    @ApiCreatedResponse({
        description: 'Login successful.',
        schema: { example: authTokensExample },
    })
    @ApiUnauthorizedResponse({
        description: 'Invalid credentials or inactive user.',
        schema: { example: unauthorizedExample },
    })
    @Post('login')
    async login(@Body() dto: LoginDto) {
        return response.success(await this.authService.login(dto));
    }

    @ApiOperation({
        summary: 'Rotate refresh token',
        description:
            'Revokes the submitted refresh token and returns a new access/refresh token pair.',
    })
    @ApiCreatedResponse({
        description: 'Token rotation successful.',
        schema: { example: authTokensExample },
    })
    @ApiUnauthorizedResponse({
        description: 'Refresh token is invalid, revoked, expired or belongs to inactive user.',
        schema: { example: { success: false, error: 'invalid refresh token' } },
    })
    @Post('refresh')
    async refresh(@Body() dto: RefreshDto) {
        return response.success(await this.authService.refreshToken(dto.refreshToken));
    }

    @ApiOperation({ summary: 'Logout by revoking refresh token' })
    @ApiCreatedResponse({
        description: 'Refresh token revoked.',
        schema: { example: { success: true, data: { loggedOut: true } } },
    })
    @Post('logout')
    async logout(@Body() dto: LogoutDto) {
        return response.success(await this.authService.logout(dto.refreshToken));
    }

    @ApiOperation({ summary: 'Get current user profile' })
    @ApiOkResponse({
        description: 'Current user profile.',
        schema: {
            example: {
                success: true,
                data: {
                    id: '11111111-1111-4111-8111-111111111111',
                    email: 'rider@example.com',
                    role: 'rider',
                    firstName: 'John',
                    lastName: 'Doe',
                    phoneNumber: '+8801712345678',
                    isEmailVerified: false,
                },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: 'Missing or invalid bearer token.',
        schema: { example: { success: false, error: 'invalid token' } },
    })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('me')
    async me(@JwtUser() user: JwtPayload) {
        return response.success(await this.authService.me(user));
    }

    @ApiOperation({ summary: 'Update current user profile' })
    @ApiOkResponse({
        description: 'Profile updated.',
        schema: {
            example: {
                success: true,
                data: {
                    id: '11111111-1111-4111-8111-111111111111',
                    email: 'rider@example.com',
                    firstName: 'Jane',
                    lastName: 'Doe',
                },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Patch('me')
    async updateMe(@JwtUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
        return response.success(await this.authService.updateMe(user, dto));
    }

    @ApiOperation({
        summary: 'Set driver availability',
        description: 'Driver-only endpoint used before accepting nearby ride matches.',
    })
    @ApiOkResponse({
        description: 'Availability changed.',
        schema: { example: { success: true, data: { isAvailable: true } } },
    })
    @ApiForbiddenResponse({
        description: 'Authenticated user is not a driver.',
        schema: { example: { success: false, error: 'insufficient role' } },
    })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('driver')
    @Put('drivers/availability')
    async setAvailability(@JwtUser() user: JwtPayload, @Body() dto: AvailabilityDto) {
        return response.success(await this.authService.setAvailability(user, dto));
    }
}
