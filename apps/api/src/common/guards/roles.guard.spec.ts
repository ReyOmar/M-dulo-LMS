import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockContext = (user?: any): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as any);

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow access on @Public() routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(true);  // IS_PUBLIC_KEY

    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('should allow access when no @Roles() decorator is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)  // IS_PUBLIC_KEY
      .mockReturnValueOnce(null);  // ROLES_KEY

    expect(guard.canActivate(mockContext({ role: 'ESTUDIANTE' }))).toBe(true);
  });

  it('should allow access when user has required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['ADMINISTRADOR']);

    expect(guard.canActivate(mockContext({ role: 'ADMINISTRADOR' }))).toBe(true);
  });

  it('should allow access when user has any of multiple allowed roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['ADMINISTRADOR', 'PROFESOR']);

    expect(guard.canActivate(mockContext({ role: 'PROFESOR' }))).toBe(true);
  });

  it('should throw ForbiddenException when user lacks required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['ADMINISTRADOR']);

    expect(() => guard.canActivate(mockContext({ role: 'ESTUDIANTE' })))
      .toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user object is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['ADMINISTRADOR']);

    expect(() => guard.canActivate(mockContext(undefined)))
      .toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user.role is null', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['ADMINISTRADOR']);

    expect(() => guard.canActivate(mockContext({ role: null })))
      .toThrow(ForbiddenException);
  });

  it('should allow any role when @Roles() has empty array', () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce([]);

    expect(guard.canActivate(mockContext({ role: 'ESTUDIANTE' }))).toBe(true);
  });
});
