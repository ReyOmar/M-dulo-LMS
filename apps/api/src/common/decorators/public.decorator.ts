import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public — bypasses JWT authentication.
 * Use on login, registration, and other public endpoints.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
