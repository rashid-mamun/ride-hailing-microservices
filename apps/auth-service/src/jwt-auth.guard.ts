import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@ride-hailing/shared-types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context
            .switchToHttp()
            .getRequest<{ headers: { authorization?: string }; user?: JwtPayload }>();
        const header = request.headers.authorization;
        if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('missing bearer token');
        request.user = jwt.verify(header.slice(7), process.env.JWT_SECRET || '') as JwtPayload;
        return true;
    }
}
