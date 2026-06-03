import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';

const requestPath = (req: Request): string =>
    (req.originalUrl || req.url || req.path).split('?')[0] || '/';

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
    private readonly redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    async use(req: Request, res: Response, next: NextFunction): Promise<void> {
        if (!requestPath(req).startsWith('/api/auth')) return next();
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const key = `throttle:auth:${ip}`;
        const count = await this.redis.incr(key);
        if (count === 1) await this.redis.expire(key, 60);
        if (count > 10) {
            res.status(429).json({ success: false, error: 'Too many authentication requests' });
            return;
        }
        next();
    }
}
