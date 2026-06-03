import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@ride-hailing/shared-types';
import { AuthRateLimitMiddleware } from '../../src/auth-rate-limit.middleware';
import { JwtMiddleware } from '../../src/jwt.middleware';
import { RedisThrottlerStorage } from '../../src/redis-throttler.storage';

const mockRedis = {
    incr: jest.fn(),
    expire: jest.fn(),
    pexpire: jest.fn(),
    pttl: jest.fn(),
    set: jest.fn(),
};

jest.mock('ioredis', () => jest.fn(() => mockRedis));
jest.mock('jsonwebtoken', () => ({ __esModule: true, default: { verify: jest.fn() } }));

type TestRequest = Request & { user?: JwtPayload };

function req(path: string, method = 'GET', authorization?: string): TestRequest {
    return {
        path,
        method,
        headers: { authorization },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
    } as unknown as TestRequest;
}

describe('API Gateway middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'access-secret-minimum-32-characters';
    });

    it('skips JWT validation for public routes', () => {
        const middleware = new JwtMiddleware();
        const next = jest.fn();

        middleware.use(req('/api/auth/login', 'POST'), {} as Response, next);

        expect(next).toHaveBeenCalled();
        expect(jwt.verify).not.toHaveBeenCalled();
    });

    it('attaches verified JWT payload to protected requests', () => {
        (jwt.verify as jest.Mock).mockReturnValueOnce({
            sub: 'user-1',
            email: 'r@example.com',
            role: 'rider',
        });
        const middleware = new JwtMiddleware();
        const request = req('/api/rides', 'GET', 'Bearer token');
        const next = jest.fn();

        middleware.use(request, {} as Response, next);

        expect(request.user).toEqual({ sub: 'user-1', email: 'r@example.com', role: 'rider' });
        expect(next).toHaveBeenCalled();
    });

    it('rejects protected requests without bearer token', () => {
        const middleware = new JwtMiddleware();

        expect(() => middleware.use(req('/api/rides'), {} as Response, jest.fn())).toThrow(
            UnauthorizedException,
        );
    });

    it('records throttler hits and blocks after the configured limit', async () => {
        mockRedis.incr.mockResolvedValueOnce(11);
        mockRedis.pttl.mockResolvedValueOnce(50000).mockResolvedValueOnce(60000);
        const storage = new RedisThrottlerStorage(mockRedis as unknown as Redis);

        await expect(storage.increment('ip', 60000, 10, 60000, 'default')).resolves.toEqual({
            totalHits: 11,
            timeToExpire: 50000,
            isBlocked: true,
            timeToBlockExpire: 60000,
        });

        expect(mockRedis.set).toHaveBeenCalledWith('throttle:default:ip:blocked', '1', 'PX', 60000);
    });

    it('limits auth endpoints to ten requests per minute', async () => {
        mockRedis.incr.mockResolvedValueOnce(11);
        const middleware = new AuthRateLimitMiddleware();
        const response = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        } as unknown as Response;

        await middleware.use(req('/api/auth/login', 'POST'), response, jest.fn());

        expect(response.status).toHaveBeenCalledWith(429);
        expect(response.json).toHaveBeenCalledWith({
            success: false,
            error: 'Too many authentication requests',
        });
    });
});
