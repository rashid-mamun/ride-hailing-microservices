import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import type { JwtPayload } from '@ride-hailing/shared-types';
import { Driver } from './entities/driver.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { AvailabilityDto, LoginDto, RegisterDto, UpdateProfileDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly jwtService: JwtService,
        @InjectRepository(User) private readonly users: Repository<User>,
        @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
        @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    ) {}

    async register(dto: RegisterDto) {
        if (dto.role === 'admin') throw new ForbiddenException('admin users cannot self-register');
        if (dto.role === 'driver' && (!dto.vehicleModel || !dto.vehiclePlate))
            throw new BadRequestException('vehicleModel and vehiclePlate are required for drivers');
        if (
            await this.users.exists({
                where: [
                    { email: dto.email },
                    ...(dto.phoneNumber ? [{ phoneNumber: dto.phoneNumber }] : []),
                ],
            })
        ) {
            throw new ConflictException('email or phone number already exists');
        }
        const passwordHash = await bcrypt.hash(dto.password, 12);
        const user = await this.dataSource.transaction(async (manager) => {
            const saved = await manager.save(User, manager.create(User, { ...dto, passwordHash }));
            if (dto.role === 'driver') {
                await manager.save(
                    Driver,
                    manager.create(Driver, {
                        userId: saved.id,
                        vehicleModel: dto.vehicleModel,
                        vehiclePlate: dto.vehiclePlate,
                    }),
                );
            }
            return saved;
        });
        return this.issueTokens(user);
    }

    async login(dto: LoginDto) {
        const user = await this.users.findOne({ where: { email: dto.email } });
        if (!user || !(await bcrypt.compare(dto.password, user.passwordHash)) || !user.isActive)
            throw new UnauthorizedException('invalid credentials');
        return this.issueTokens(user);
    }

    async refreshToken(token: string) {
        try {
            await this.jwtService.verifyAsync(token, { secret: process.env.JWT_REFRESH_SECRET });
        } catch {
            throw new UnauthorizedException('invalid refresh token');
        }
        const entity = await this.refreshTokens.findOne({
            where: { token, isRevoked: false },
            relations: { user: true },
        });
        if (!entity || entity.expiresAt < new Date() || !entity.user.isActive)
            throw new UnauthorizedException('invalid refresh token');
        await this.refreshTokens.update(entity.id, { isRevoked: true });
        return this.issueTokens(entity.user);
    }

    async logout(token: string) {
        await this.refreshTokens.update({ token }, { isRevoked: true });
        return { loggedOut: true };
    }

    async me(user: JwtPayload) {
        return this.users.findOneOrFail({
            where: { id: user.sub },
            select: [
                'id',
                'email',
                'role',
                'firstName',
                'lastName',
                'phoneNumber',
                'isEmailVerified',
                'createdAt',
            ],
        });
    }

    async updateMe(user: JwtPayload, dto: UpdateProfileDto) {
        await this.users.update(user.sub, dto);
        return this.me(user);
    }

    async setAvailability(user: JwtPayload, dto: AvailabilityDto) {
        if (user.role !== 'driver') throw new ForbiddenException('driver role required');
        const result = await this.drivers.update(
            { userId: user.sub },
            { isAvailable: dto.isAvailable },
        );
        if (!result.affected) throw new ForbiddenException('driver profile not found');
        return { isAvailable: dto.isAvailable };
    }

    private async issueTokens(user: User) {
        await this.refreshTokens.update({ userId: user.id, isRevoked: false }, { isRevoked: true });
        const accessToken = await this.signAccess(user);
        const refreshToken = await this.jwtService.signAsync(
            { sub: user.id },
            {
                secret: process.env.JWT_REFRESH_SECRET,
                expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as never,
            },
        );
        await this.refreshTokens.save({
            token: refreshToken,
            userId: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        const safeUser = { ...user } as Omit<User, 'passwordHash'> & { passwordHash?: string };
        delete safeUser.passwordHash;
        return { accessToken, refreshToken, user: safeUser };
    }

    private signAccess(user: User): Promise<string> {
        return this.jwtService.signAsync(
            { sub: user.id, email: user.email, role: user.role },
            {
                secret: process.env.JWT_SECRET,
                expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as never,
            },
        );
    }
}
