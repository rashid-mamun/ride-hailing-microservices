import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@ride-hailing/shared-types';

const publicRoutes = [
    ['POST', '/api/auth/register'],
    ['POST', '/api/auth/login'],
    ['POST', '/api/v1/auth/register'],
    ['POST', '/api/v1/auth/login'],
    ['GET', '/health'],
    ['GET', '/api/docs'],
];

const requestPath = (req: Request): string =>
    (req.originalUrl || req.url || req.path).split('?')[0] || '/';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
    use(req: Request & { user?: JwtPayload }, _res: Response, next: NextFunction): void {
        const path = requestPath(req);
        if (publicRoutes.some(([method, route]) => req.method === method && path.startsWith(route)))
            return next();
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');
        req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET || '') as JwtPayload;
        next();
    }
}
