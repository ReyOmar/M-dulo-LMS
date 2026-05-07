/**
 * Shape of the JWT payload attached to request.user by JwtAuthGuard.
 * Use this instead of `any` in all @CurrentUser() parameters.
 */
export interface JwtPayload {
  /** User GUID (from JWT 'sub' claim) */
  sub: string;
  /** User role — synced from DB on each request */
  role: 'ADMINISTRADOR' | 'PROFESOR' | 'ESTUDIANTE';
  /** JWT issued-at timestamp (seconds) */
  iat: number;
  /** JWT expiration timestamp (seconds) */
  exp: number;
}
