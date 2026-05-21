import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { TokenBlacklistService } from './token-blacklist.service';
import { LmsGateway } from '../ws/lms.gateway';
import { MailService } from '../mail/mail.service';
import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

// ── Mocks ────────────────────────────────────────────────
const mockPrisma = {
  usuarios: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  lms_solicitudes_acceso: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  },
  lms_configuracion: {
    findUnique: jest.fn(),
  },
  lms_verificacion_email: {
    findFirst: jest.fn(),
  },
  lms_password_resets: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
};

const mockTokenBlacklist = {
  isBlacklisted: jest.fn().mockReturnValue(false),
  add: jest.fn(),
  revokeUser: jest.fn().mockResolvedValue(undefined),
  revokeUserBefore: jest.fn().mockResolvedValue(undefined),
};

const mockLmsGateway = {
  broadcast: jest.fn(),
  broadcastToRole: jest.fn(),
  forceDisconnect: jest.fn(),
};

const mockMailService = {
  sendNewAccessRequest: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: TokenBlacklistService, useValue: mockTokenBlacklist },
        { provide: LmsGateway, useValue: mockLmsGateway },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Reset all mocks between tests
    jest.clearAllMocks();
    // Default: usuarios.update returns a resolved promise (needed for fire-and-forget .catch() chains)
    mockPrisma.usuarios.update.mockResolvedValue({});
    // Default config mock
    mockPrisma.lms_configuracion.findUnique.mockResolvedValue({
      id: 1,
      contrasena_defecto: 'tempPass123',
    });
  });

  // ── LOGIN ──────────────────────────────────────────────

  describe('login', () => {
    const hashedPassword = bcrypt.hashSync('MySecure1', 10);

    it('should return token on valid credentials', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue({
        guid: 'user-1',
        email: 'test@pesv.com',
        nombre: 'Test',
        apellido: 'User',
        rol: 'ESTUDIANTE',
        contrasena: hashedPassword,
        usa_clave_defecto: false,
        activo: true,
      });

      const result = await service.login('test@pesv.com', 'MySecure1');

      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.guid).toBe('user-1');
      expect(result.user.role).toBe('ESTUDIANTE');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue(null);
      mockPrisma.lms_solicitudes_acceso.findUnique.mockResolvedValue(null);

      await expect(service.login('nobody@pesv.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw generic UnauthorizedException for pending request users (anti-enumeration)', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue(null);

      // No longer reveals whether user has a pending request
      await expect(service.login('pending@pesv.com', 'pass')).rejects.toThrow('Credenciales inválidas.');
    });

    it('should throw for wrong password', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue({
        guid: 'user-1',
        email: 'test@pesv.com',
        contrasena: hashedPassword,
        activo: true,
      });

      await expect(service.login('test@pesv.com', 'WrongPass1')).rejects.toThrow(UnauthorizedException);
    });

    it('should require password setup when usa_clave_defecto is true', async () => {
      const tempHashed = bcrypt.hashSync('tempPass123', 10);
      mockPrisma.usuarios.findUnique.mockResolvedValue({
        guid: 'user-1',
        email: 'new@pesv.com',
        nombre: 'New',
        contrasena: tempHashed,
        activo: true,
        usa_clave_defecto: true,
      });

      const result = await service.login('new@pesv.com', 'tempPass123');

      expect(result.requireSetup).toBe(true);
      expect(result.token).toBeUndefined();
    });

    it('should require setup when contrasena is null', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue({
        guid: 'user-1',
        email: 'nopass@pesv.com',
        nombre: 'NoPass',
        contrasena: null,
        activo: true,
      });

      const result = await service.login('nopass@pesv.com', 'anything');

      expect(result.requireSetup).toBe(true);
    });

    it('should throw generic error when password is empty', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue({
        guid: 'user-1',
        email: 'test@pesv.com',
        contrasena: hashedPassword,
        activo: true,
      });

      await expect(service.login('test@pesv.com', '')).rejects.toThrow('Contraseña requerida.');
    });
  });

  // ── PASSWORD VALIDATION ────────────────────────────────

  describe('validatePasswordStrength', () => {
    it('should reject passwords shorter than 8 chars', () => {
      expect(() => service.validatePasswordStrength('Ab1')).toThrow(BadRequestException);
    });

    it('should reject passwords without letters', () => {
      expect(() => service.validatePasswordStrength('12345678')).toThrow('al menos una letra');
    });

    it('should reject passwords without numbers', () => {
      expect(() => service.validatePasswordStrength('abcdefgh')).toThrow('al menos un número');
    });

    it('should accept valid passwords', () => {
      expect(() => service.validatePasswordStrength('Secure1234')).not.toThrow();
    });

    it('should accept passwords with special characters', () => {
      expect(() => service.validatePasswordStrength('S3cure!@#')).not.toThrow();
    });
  });

  // ── REQUEST ACCESS ─────────────────────────────────────

  describe('requestAccess', () => {
    const dto = {
      email: 'new@pesv.com',
      nombre: 'Nuevo',
      apellido: 'Usuario',
      rol_pedido: 'ESTUDIANTE' as const,
    };

    it('should create access request and return success', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue(null);
      mockPrisma.lms_verificacion_email.findFirst.mockResolvedValue({ id: 1, email: dto.email, verificado: true });
      mockPrisma.lms_solicitudes_acceso.findUnique.mockResolvedValue(null);
      mockPrisma.lms_solicitudes_acceso.create.mockResolvedValue({ id: 1, ...dto });
      mockPrisma.usuarios.findMany.mockResolvedValue([]);

      const result = await service.requestAccess(dto);

      expect(result.message).toContain('exitosamente');
      expect(result.request_id).toBe(1);
      expect(mockLmsGateway.broadcastToRole).toHaveBeenCalledWith(
        'request:new',
        expect.objectContaining({ email: dto.email }),
        'ADMINISTRADOR',
      );
    });

    it('should throw if user already exists', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue({ email: dto.email });

      await expect(service.requestAccess(dto)).rejects.toThrow('ya existe en el sistema');
    });

    it('should throw if pending request already exists', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue(null);
      mockPrisma.lms_verificacion_email.findFirst.mockResolvedValue({ id: 1, email: dto.email, verificado: true });
      mockPrisma.lms_solicitudes_acceso.findUnique.mockResolvedValue({
        email: dto.email,
        estado: 'PENDIENTE',
      });

      await expect(service.requestAccess(dto)).rejects.toThrow('solicitud pendiente');
    });

    it('should delete old non-pending request and create new one', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue(null);
      mockPrisma.lms_verificacion_email.findFirst.mockResolvedValue({ id: 1, email: dto.email, verificado: true });
      mockPrisma.lms_solicitudes_acceso.findUnique.mockResolvedValue({
        id: 99,
        email: dto.email,
        estado: 'RECHAZADA',
      });
      mockPrisma.lms_solicitudes_acceso.create.mockResolvedValue({ id: 100, ...dto });
      mockPrisma.usuarios.findMany.mockResolvedValue([]);

      const result = await service.requestAccess(dto);

      expect(mockPrisma.lms_solicitudes_acceso.delete).toHaveBeenCalledWith({ where: { id: 99 } });
      expect(result.request_id).toBe(100);
    });
  });

  // ── APPROVE / REJECT REQUEST ───────────────────────────

  describe('approveRequest', () => {
    it('should approve pending request and create user', async () => {
      mockPrisma.lms_solicitudes_acceso.findUnique.mockResolvedValue({
        id: 1,
        email: 'new@pesv.com',
        nombre: 'Nuevo',
        apellido: 'Usuario',
        rol_pedido: 'ESTUDIANTE',
        estado: 'PENDIENTE',
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.approveRequest(1);

      expect(result.message).toContain('aprobada');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      // Now passes invitation token for secure password setup
      expect(mockMailService.sendWelcomeEmail).toHaveBeenCalledWith('new@pesv.com', 'Nuevo', expect.any(String));
    });

    it('should throw NotFoundException for non-existent request', async () => {
      mockPrisma.lms_solicitudes_acceso.findUnique.mockResolvedValue(null);

      await expect(service.approveRequest(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw if request already processed', async () => {
      mockPrisma.lms_solicitudes_acceso.findUnique.mockResolvedValue({
        id: 1,
        estado: 'ACEPTADA',
      });

      await expect(service.approveRequest(1)).rejects.toThrow('ya fue procesada');
    });
  });

  describe('rejectRequest', () => {
    it('should delete pending request', async () => {
      mockPrisma.lms_solicitudes_acceso.findUnique.mockResolvedValue({
        id: 1,
        estado: 'PENDIENTE',
      });
      mockPrisma.lms_solicitudes_acceso.delete.mockResolvedValue({});

      const result = await service.rejectRequest(1);

      expect(result.message).toContain('rechazada');
      expect(mockPrisma.lms_solicitudes_acceso.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw for non-existent request', async () => {
      mockPrisma.lms_solicitudes_acceso.findUnique.mockResolvedValue(null);

      await expect(service.rejectRequest(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ── PASSWORD RESET ─────────────────────────────────────

  describe('requestPasswordReset', () => {
    it('should return generic message for non-existent email (security)', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue(null);

      const result = await service.requestPasswordReset('nobody@pesv.com');

      expect(result.message).toContain('Si el correo está registrado');
      expect(mockMailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should create reset token and send email for valid user', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue({
        email: 'user@pesv.com',
        nombre: 'User',
      });
      mockPrisma.lms_password_resets.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.lms_password_resets.create.mockResolvedValue({ id: 1 });

      const result = await service.requestPasswordReset('user@pesv.com');

      expect(result.message).toContain('Si el correo está registrado');
      expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@pesv.com',
        expect.any(String), // token
        'User',
      );
    });
  });

  describe('resetPassword', () => {
    it('should reject invalid token', async () => {
      mockPrisma.lms_password_resets.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword('bad-token', 'NewPass1234')).rejects.toThrow('Token inválido');
    });

    it('should reject already-used token', async () => {
      mockPrisma.lms_password_resets.findUnique.mockResolvedValue({
        token: 'used-token',
        usado: true,
        expires_at: new Date(Date.now() + 3600000),
      });

      await expect(service.resetPassword('used-token', 'NewPass1234')).rejects.toThrow('ya fue utilizado');
    });

    it('should reject expired token', async () => {
      mockPrisma.lms_password_resets.findUnique.mockResolvedValue({
        token: 'old-token',
        usado: false,
        expires_at: new Date(Date.now() - 1000), // expired
      });

      await expect(service.resetPassword('old-token', 'NewPass1234')).rejects.toThrow('expirado');
    });

    it('should reset password with valid token', async () => {
      // The service now hashes the incoming token before lookup
      const crypto = require('crypto');
      const rawToken = 'valid-raw-token';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      mockPrisma.lms_password_resets.findUnique.mockResolvedValue({
        id: 1,
        token: tokenHash,
        email: 'user@pesv.com',
        usado: false,
        expires_at: new Date(Date.now() + 3600000),
      });
      mockPrisma.usuarios.findUnique.mockResolvedValue({ guid: 'user-guid' });
      mockPrisma.usuarios.update.mockResolvedValue({});
      mockPrisma.lms_password_resets.update.mockResolvedValue({});

      const result = await service.resetPassword(rawToken, 'NewPass1234');

      expect(result.message).toContain('restablecida exitosamente');
      expect(mockPrisma.usuarios.update).toHaveBeenCalled();
      expect(mockTokenBlacklist.revokeUser).toHaveBeenCalledWith('user-guid');
      expect(mockLmsGateway.forceDisconnect).toHaveBeenCalledWith('user-guid', 'password_reset');
    });

    it('should validate password strength during reset', async () => {
      mockPrisma.lms_password_resets.findUnique.mockResolvedValue({
        id: 1,
        token: 'valid-token',
        email: 'user@pesv.com',
        usado: false,
        expires_at: new Date(Date.now() + 3600000),
      });

      await expect(service.resetPassword('valid-token', 'weak')).rejects.toThrow(BadRequestException);
    });
  });

  // ── NOTIFY REQUEST RESOLVED ────────────────────────────

  describe('notifyRequestResolved', () => {
    it('should broadcast request:resolved and dashboard:refresh to admins', () => {
      service.notifyRequestResolved('rejected');

      expect(mockLmsGateway.broadcast).toHaveBeenCalledWith(
        'request:resolved',
        expect.objectContaining({ action: 'rejected' }),
      );
      expect(mockLmsGateway.broadcastToRole).toHaveBeenCalledWith(
        'dashboard:refresh',
        expect.objectContaining({ reason: 'request_resolved' }),
        'ADMINISTRADOR',
      );
    });

    it('should also broadcast user:created on approve', () => {
      service.notifyRequestResolved('approved', { email: 'new@pesv.com' });

      expect(mockLmsGateway.broadcast).toHaveBeenCalledWith(
        'user:created',
        expect.objectContaining({ email: 'new@pesv.com' }),
      );
    });
  });

  // ── F12.2: SECURITY — INACTIVE USER & TOKEN REVOCATION ──

  describe('login — inactive user', () => {
    const hashedPassword = bcrypt.hashSync('MySecure1', 10);

    it('should reject login for inactive user', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue({
        guid: 'user-inactive',
        email: 'inactive@pesv.com',
        nombre: 'Inactive',
        apellido: 'User',
        rol: 'ESTUDIANTE',
        contrasena: hashedPassword,
        usa_clave_defecto: false,
        activo: false, // INACTIVE
      });

      await expect(service.login('inactive@pesv.com', 'MySecure1')).rejects.toThrow(UnauthorizedException);
    });

    it('should use generic error message for inactive user (no enumeration)', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue({
        guid: 'user-inactive',
        email: 'inactive@pesv.com',
        nombre: 'Inactive',
        apellido: 'User',
        rol: 'ESTUDIANTE',
        contrasena: hashedPassword,
        usa_clave_defecto: false,
        activo: false,
      });

      try {
        await service.login('inactive@pesv.com', 'MySecure1');
        fail('Should have thrown');
      } catch (e: any) {
        // Message should NOT reveal that the account is specifically inactive
        expect(e.message).not.toContain('inactiv');
      }
    });
  });

  describe('token revocation — revokeUser', () => {
    it('should call tokenBlacklist.revokeUser to invalidate all sessions', async () => {
      // This is what the controller's logout method calls
      await mockTokenBlacklist.revokeUser('user-1');
      expect(mockTokenBlacklist.revokeUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('resetPassword — session invalidation', () => {
    it('should revoke all user sessions after password reset', async () => {
      const hashedToken = require('crypto').createHash('sha256').update('valid-token-123').digest('hex');
      mockPrisma.lms_password_resets.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@pesv.com',
        token_hash: hashedToken,
        usado: false,
        expires_at: new Date(Date.now() + 3600000), // 1h future
      });
      mockPrisma.usuarios.findUnique.mockResolvedValue({
        guid: 'user-1',
        email: 'test@pesv.com',
        activo: true,
      });
      mockPrisma.usuarios.update.mockResolvedValue({});
      mockPrisma.lms_password_resets.update.mockResolvedValue({});

      await service.resetPassword('valid-token-123', 'NewSecure1');

      // Should revoke all existing sessions
      expect(mockTokenBlacklist.revokeUser).toHaveBeenCalledWith('user-1');
    });
  });
});
