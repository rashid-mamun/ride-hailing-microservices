import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '@ride-hailing/shared-types';

export const JwtUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtPayload => {
    return ctx.switchToHttp().getRequest<{ user: JwtPayload }>().user;
});
