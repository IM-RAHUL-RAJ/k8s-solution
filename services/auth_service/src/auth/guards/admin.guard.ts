import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../types/jwt-payload';

/**
 * Lets a request through only when the verified token carries the ADMIN role.
 * Always used after JwtAuthGuard, which puts the verified payload on the request.
 */
@Injectable()
export class AdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
        const roles = request.user?.roles ?? [];

        const isAdmin = roles
            .filter((role) => typeof role === 'string')
            .map((role) => role.trim().toUpperCase().replace(/^ROLE_/, ''))
            .includes('ADMIN');

        if (!isAdmin) {
            throw new ForbiddenException({
                errorCode: 'AUTH-403',
                message: 'Forbidden',
            });
        }
        return true;
    }
}
