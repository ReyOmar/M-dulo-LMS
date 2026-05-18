/**
 * Minimal user context passed to service methods for authorization checks.
 * Lighter than JwtPayload — only the fields needed for permission validation.
 * Use this instead of `any` for requestUser parameters in services.
 */
export interface RequestUser {
  /** User GUID */
  sub: string;
  /** User role */
  role: 'ADMINISTRADOR' | 'PROFESOR' | 'ESTUDIANTE';
}
