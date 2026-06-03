import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { DataSource, Repository, UpdateResult } from 'typeorm';
import { Driver } from '../../src/entities/driver.entity';
import { RefreshToken } from '../../src/entities/refresh-token.entity';
import { User } from '../../src/entities/user.entity';
import { AuthService } from '../../src/auth.service';

jest.mock('bcrypt', () => ({
    __esModule: true,
    default: {
        hash: jest.fn(),
        compare: jest.fn(),
    },
}));

const user: User = {
    id: 'user-1',
    email: 'rider@example.com',
    passwordHash: 'hash',
    role: 'rider' as const,
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    isEmailVerified: false,
    phoneNumber: undefined,
    refreshTokens: [],
    createdAt: new Date(),
    updatedAt: new Date(),
};

function makeRefreshToken(overrides: Partial<RefreshToken> = {}): RefreshToken {
    return {
        id: 'refresh-1',
        token: 'refresh-token',
        userId: user.id,
        user,
        expiresAt: new Date(Date.now() + 10000),
        isRevoked: false,
        createdAt: new Date(),
        ...overrides,
    };
}

type TransactionManager = {
    create: jest.MockedFunction<(entity: unknown, value: unknown) => unknown>;
    save: jest.MockedFunction<(entity: unknown, value: unknown) => Promise<unknown>>;
};

function createService(
    overrides: Partial<{
        dataSource: Partial<DataSource>;
        jwtService: Partial<JwtService>;
        users: Partial<Repository<User>>;
        refreshTokens: Partial<Repository<RefreshToken>>;
        drivers: Partial<Repository<Driver>>;
    }> = {},
) {
    const manager: TransactionManager = {
        create: jest.fn<unknown, [unknown, unknown]>((_entity, value) => value),
        save: jest.fn<Promise<unknown>, [unknown, unknown]>(async (_entity, value) => {
            const record = value as { id?: string };
            return { ...record, id: record.id || 'user-1', isActive: true };
        }),
    };
    const deps = {
        dataSource: {
            transaction: jest.fn((fn: (manager: TransactionManager) => unknown) => fn(manager)),
        },
        jwtService: {
            signAsync: jest.fn(async (payload: { email?: string }) =>
                payload.email ? 'access-token' : 'refresh-token',
            ),
            verifyAsync: jest.fn(async () => ({ sub: 'user-1' })),
        },
        users: {
            exists: jest.fn(async () => false),
            findOne: jest.fn(async () => user),
            findOneOrFail: jest.fn(async () => user),
            update: jest.fn(
                async () => ({ affected: 1, generatedMaps: [], raw: [] }) as UpdateResult,
            ),
        },
        refreshTokens: {
            update: jest.fn(
                async () => ({ affected: 1, generatedMaps: [], raw: [] }) as UpdateResult,
            ),
            save: jest.fn(async (value) => value),
            findOne: jest.fn(async () => makeRefreshToken()),
        },
        drivers: {
            update: jest.fn(
                async () => ({ affected: 1, generatedMaps: [], raw: [] }) as UpdateResult,
            ),
        },
        ...overrides,
    };

    return {
        service: new AuthService(
            deps.dataSource as DataSource,
            deps.jwtService as JwtService,
            deps.users as Repository<User>,
            deps.refreshTokens as Repository<RefreshToken>,
            deps.drivers as Repository<Driver>,
        ),
        deps,
        manager,
    };
}

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'access-secret-minimum-32-characters';
        process.env.JWT_REFRESH_SECRET = 'refresh-secret-minimum-32-characters';
        (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    });

    it('registers a rider, hashes password, stores user transactionally and returns tokens', async () => {
        const { service, deps, manager } = createService();

        const result = await service.register({
            email: 'rider@example.com',
            password: 'StrongPass123',
            role: 'rider',
            firstName: 'John',
            lastName: 'Doe',
        });

        expect(bcrypt.hash).toHaveBeenCalledWith('StrongPass123', 12);
        expect(deps.dataSource.transaction).toHaveBeenCalledTimes(1);
        expect(manager.save).toHaveBeenCalledTimes(1);
        expect(deps.refreshTokens.update).toHaveBeenCalledWith(
            { userId: 'user-1', isRevoked: false },
            { isRevoked: true },
        );
        expect(result).toMatchObject({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
        });
        expect('passwordHash' in result.user).toBe(false);
    });

    it('creates a driver profile when registering a driver', async () => {
        const { service, manager } = createService();

        await service.register({
            email: 'driver@example.com',
            password: 'StrongPass123',
            role: 'driver',
            firstName: 'Jane',
            lastName: 'Driver',
            vehicleModel: 'Toyota Axio',
            vehiclePlate: 'DHA-1234',
        });

        expect(manager.save).toHaveBeenCalledTimes(2);
        expect(manager.save.mock.calls[1][1]).toMatchObject({
            userId: 'user-1',
            vehicleModel: 'Toyota Axio',
            vehiclePlate: 'DHA-1234',
        });
    });

    it('rejects duplicate email or phone', async () => {
        const { service } = createService({ users: { exists: jest.fn(async () => true) } });

        await expect(
            service.register({
                email: 'rider@example.com',
                password: 'StrongPass123',
                role: 'rider',
                firstName: 'John',
                lastName: 'Doe',
            }),
        ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects public admin registration and incomplete driver registration', async () => {
        const { service } = createService();

        await expect(
            service.register({
                email: 'admin@example.com',
                password: 'StrongPass123',
                role: 'admin',
                firstName: 'A',
                lastName: 'D',
            }),
        ).rejects.toBeInstanceOf(ForbiddenException);

        await expect(
            service.register({
                email: 'driver@example.com',
                password: 'StrongPass123',
                role: 'driver',
                firstName: 'Jane',
                lastName: 'Driver',
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('logs in active users with a valid password', async () => {
        const { service } = createService();

        const result = await service.login({
            email: 'rider@example.com',
            password: 'StrongPass123',
        });

        expect(bcrypt.compare).toHaveBeenCalledWith('StrongPass123', 'hash');
        expect(result.accessToken).toBe('access-token');
    });

    it('rejects missing users, wrong password and inactive users', async () => {
        await expect(
            createService({ users: { findOne: jest.fn(async () => null) } }).service.login({
                email: 'x@y.com',
                password: 'bad',
            }),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
        await expect(
            createService().service.login({ email: 'rider@example.com', password: 'bad' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        await expect(
            createService({
                users: { findOne: jest.fn(async () => ({ ...user, isActive: false })) },
            }).service.login({ email: 'rider@example.com', password: 'StrongPass123' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rotates refresh token when JWT and DB token are valid', async () => {
        const { service, deps } = createService();

        await expect(service.refreshToken('refresh-token')).resolves.toMatchObject({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            user: { id: 'user-1' },
        });
        expect(deps.jwtService.verifyAsync).toHaveBeenCalledWith('refresh-token', {
            secret: process.env.JWT_REFRESH_SECRET,
        });
        expect(deps.refreshTokens.update).toHaveBeenCalledWith('refresh-1', { isRevoked: true });
    });

    it('rejects invalid, revoked, expired or inactive refresh tokens', async () => {
        await expect(
            createService({
                jwtService: {
                    verifyAsync: jest.fn(async () => {
                        throw new Error('bad');
                    }),
                },
            }).service.refreshToken('bad'),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        await expect(
            createService({
                refreshTokens: { findOne: jest.fn(async () => null) },
            }).service.refreshToken('missing'),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        await expect(
            createService({
                refreshTokens: {
                    findOne: jest.fn(async () =>
                        makeRefreshToken({ expiresAt: new Date(Date.now() - 1000) }),
                    ),
                },
            }).service.refreshToken('expired'),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        await expect(
            createService({
                refreshTokens: {
                    findOne: jest.fn(async () =>
                        makeRefreshToken({ user: { ...user, isActive: false } }),
                    ),
                },
            }).service.refreshToken('inactive'),
        ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('logs out by revoking refresh token', async () => {
        const { service, deps } = createService();

        await expect(service.logout('refresh-token')).resolves.toEqual({ loggedOut: true });
        expect(deps.refreshTokens.update).toHaveBeenCalledWith(
            { token: 'refresh-token' },
            { isRevoked: true },
        );
    });

    it('allows only existing drivers to toggle availability', async () => {
        const { service } = createService();

        await expect(
            service.setAvailability(
                { sub: 'user-1', email: 'd@example.com', role: 'driver' },
                { isAvailable: true },
            ),
        ).resolves.toEqual({ isAvailable: true });
        await expect(
            service.setAvailability(
                { sub: 'user-1', email: 'r@example.com', role: 'rider' },
                { isAvailable: true },
            ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(
            createService({
                drivers: {
                    update: jest.fn(
                        async () => ({ affected: 0, generatedMaps: [], raw: [] }) as UpdateResult,
                    ),
                },
            }).service.setAvailability(
                { sub: 'missing', email: 'd@example.com', role: 'driver' },
                { isAvailable: true },
            ),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });
});
