import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to specific roles.
 * Usage: @Roles('ADMINISTRADOR', 'PROFESOR')
 * Requires RolesGuard to be registered (globally or per-route).
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
