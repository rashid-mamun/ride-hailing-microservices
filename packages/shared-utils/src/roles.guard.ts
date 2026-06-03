import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { JwtPayload, UserRole } from '@ride-hailing/shared-types';
import { ROLES_KEY } from './roles.decorator';

type RequestWithUser = {
    user?: JwtPayload;
};

@Injectable()
export class RolesGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const roles = this.getRoles(context);
        if (!roles.length) return true;

        const request = context.switchToHttp().getRequest<RequestWithUser>();
        if (!request.user || !roles.includes(request.user.role)) {
            throw new ForbiddenException('insufficient role');
        }

        return true;
    }

    private getRoles(context: ExecutionContext): UserRole[] {
        const handlerRoles = Reflect.getMetadata(ROLES_KEY, context.getHandler()) as
            | UserRole[]
            | undefined;
        const classRoles = Reflect.getMetadata(ROLES_KEY, context.getClass()) as
            | UserRole[]
            | undefined;
        return handlerRoles ?? classRoles ?? [];
    }
}
