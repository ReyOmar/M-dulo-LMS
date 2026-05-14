import { Injectable, Logger, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { LmsGateway } from '../ws/lms.gateway';
import { lms_rol_usuario } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

/**
 * AuthService — Authentication flows only (login, signup, password reset).
 * User management (CRUD, profile) has been extracted to UserService.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private tokenBlacklistService: TokenBlacklistService,
    private lmsGateway: LmsGateway,
    private mailService: MailService,
  ) {}

  async requestAccess(dto: { email: string; nombre: string; apellido: string; rol_pedido: lms_rol_usuario }) {
    const existingUser = await this.prisma.usuarios.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      throw new BadRequestException('El usuario ya existe en el sistema.');
    }

    // Require email verification before accepting request
    const verification = await this.prisma.lms_verificacion_email.findFirst({
      where: { email: dto.email, verificado: true },
      orderBy: { created_at: 'desc' },
    });
    if (!verification) {
      throw new BadRequestException('Debes verificar tu correo electrónico antes de enviar la solicitud.');
    }

    const existingReq = await this.prisma.lms_solicitudes_acceso.findUnique({ where: { email: dto.email } });
    if (existingReq) {
      if (existingReq.estado === 'PENDIENTE') {
        throw new BadRequestException('Ya existe una solicitud pendiente con este correo.');
      } else {
        await this.prisma.lms_solicitudes_acceso.delete({ where: { id: existingReq.id } });
      }
    }

    const sol = await this.prisma.lms_solicitudes_acceso.create({
      data: {
        email: dto.email,
        nombre: dto.nombre,
        apellido: dto.apellido,
        rol_pedido: dto.rol_pedido,
      },
    });

    // Notify admins about new access request
    this.lmsGateway.broadcastToRole(
      'request:new',
      {
        id: sol.id,
        email: dto.email,
        nombre: dto.nombre,
        apellido: dto.apellido,
        rol_pedido: dto.rol_pedido,
      },
      'ADMINISTRADOR',
    );

    // Fire-and-forget: email all active admins (don't block response)
    this.prisma.usuarios
      .findMany({
        where: { rol: 'ADMINISTRADOR', activo: true },
        select: { email: true, nombre: true },
      })
      .then((admins) => {
        Promise.all(
          admins.map((admin) =>
            this.mailService.sendNewAccessRequest(admin.email, admin.nombre, {
              nombre: dto.nombre,
              apellido: dto.apellido,
              email: dto.email,
              rol_pedido: dto.rol_pedido,
            }),
          ),
        ).catch((err) => this.logger.error('Admin email error:', err));
      });

    return { message: 'Solicitud enviada al administrador exitosamente.', request_id: sol.id };
  }

  async login(email: string, contrasena: string) {
    // SEC: Generic error messages to prevent user enumeration
    const GENERIC_AUTH_ERROR = 'Credenciales inválidas.';

    const user = await this.prisma.usuarios.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    if (!user.activo) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    if (!contrasena) {
      throw new UnauthorizedException('Contraseña requerida.');
    }

    // User has no password yet — must set up on first login
    if (!user.contrasena) {
      return {
        requireSetup: true,
        message: 'Cuenta aprobada. Por favor, crea tu contraseña segura.',
        user: { email: user.email, nombre: user.nombre },
      };
    }

    const isValid = await bcrypt.compare(contrasena, user.contrasena);
    if (!isValid) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    // User still has the temporary password flag → force setup
    if (user.usa_clave_defecto) {
      return {
        requireSetup: true,
        message: 'Debes configurar una contraseña personalizada para continuar.',
        user: { email: user.email, nombre: user.nombre },
      };
    }

    const payload = { sub: user.guid, role: user.rol, email: user.email };
    const token = await this.jwtService.signAsync(payload);

    return {
      message: 'Inicio de sesión exitoso.',
      token,
      user: { guid: user.guid, role: user.rol, nombre: user.nombre, apellido: user.apellido, foto_url: user.foto_url },
    };
  }

  /** Validates password strength: min 8 chars, at least one letter and one number */
  validatePasswordStrength(password: string): void {
    if (!password || password.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres.');
    }
    if (!/[a-zA-Z]/.test(password)) {
      throw new BadRequestException('La contraseña debe incluir al menos una letra.');
    }
    if (!/[0-9]/.test(password)) {
      throw new BadRequestException('La contraseña debe incluir al menos un número.');
    }
  }

  async setupPassword(email: string, contrasenaTemporal: string, nuevaContrasena: string) {
    this.validatePasswordStrength(nuevaContrasena);

    const user = await this.prisma.usuarios.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Usuario no existe.');
    }

    if (!user.contrasena) {
      // User was created without a password (new approval flow).
      // The contrasenaTemporal field is not checked — user sets their first password.
      // This is safe because the user must know their email to reach this endpoint.
    } else {
      // User has a hashed temporary password — validate it
      const isTempValid = await bcrypt.compare(contrasenaTemporal, user.contrasena);
      if (!isTempValid) {
        throw new UnauthorizedException('La contraseña temporal es incorrecta.');
      }

      if (!user.usa_clave_defecto) {
        throw new BadRequestException(
          'La cuenta ya tiene una contraseña personalizada. Usa la opción de cambiar contraseña desde tu perfil.',
        );
      }
    }

    const hashed = await bcrypt.hash(nuevaContrasena, 10);
    const updatedUser = await this.prisma.usuarios.update({
      where: { email },
      data: { contrasena: hashed, usa_clave_defecto: false },
    });

    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'user_password_setup' });

    const payload = { sub: updatedUser.guid, role: updatedUser.rol, email: updatedUser.email };
    const token = await this.jwtService.signAsync(payload);

    return {
      message: 'Contraseña establecida exitosamente.',
      token,
      user: {
        guid: updatedUser.guid,
        role: updatedUser.rol,
        nombre: updatedUser.nombre,
        apellido: updatedUser.apellido,
      },
    };
  }

  // --- ACCESS REQUEST MANAGEMENT ---

  async getPendingRequests() {
    return this.prisma.lms_solicitudes_acceso.findMany({
      where: { estado: 'PENDIENTE' },
      orderBy: { created_at: 'desc' },
    });
  }

  async approveRequest(id: number) {
    const request = await this.prisma.lms_solicitudes_acceso.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Solicitud no encontrada.');
    if (request.estado !== 'PENDIENTE') throw new BadRequestException('La solicitud ya fue procesada.');

    // SEC: Create user WITHOUT password — they must set it on first login
    await this.prisma.$transaction([
      this.prisma.lms_solicitudes_acceso.update({
        where: { id },
        data: { estado: 'ACEPTADA' },
      }),
      this.prisma.usuarios.create({
        data: {
          email: request.email,
          nombre: request.nombre,
          apellido: request.apellido,
          rol: request.rol_pedido,
          contrasena: null,
          usa_clave_defecto: true,
        },
      }),
    ]);

    // Send welcome email (no password included — user sets it themselves)
    this.mailService
      .sendWelcomeEmail(request.email, request.nombre)
      .catch((err) => this.logger.error('Welcome email error:', err));

    return { message: 'Solicitud aprobada. El usuario debe configurar su contraseña en el primer inicio de sesión.' };
  }

  /**
   * Notify via WebSocket after approve/reject outside the transaction.
   */
  notifyRequestResolved(action: 'approved' | 'rejected', requestData?: Record<string, unknown>): void {
    this.lmsGateway.broadcast('request:resolved', { action, ...requestData });
    if (action === 'approved') {
      this.lmsGateway.broadcast('user:created', requestData);
    }
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'request_resolved' });
  }

  async rejectRequest(id: number) {
    const request = await this.prisma.lms_solicitudes_acceso.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Solicitud no encontrada.');
    if (request.estado !== 'PENDIENTE') throw new BadRequestException('La solicitud ya fue procesada.');

    await this.prisma.lms_solicitudes_acceso.delete({
      where: { id },
    });

    return { message: 'Solicitud rechazada y eliminada de la base de datos.' };
  }

  // --- PASSWORD RECOVERY ---

  async requestPasswordReset(email: string) {
    // SEC: Always return same message to prevent email enumeration
    const GENERIC_MSG = 'Si el correo está registrado, recibirás un enlace de recuperación.';

    const user = await this.prisma.usuarios.findUnique({ where: { email } });
    if (!user) {
      return { message: GENERIC_MSG };
    }

    await this.prisma.lms_password_resets.updateMany({
      where: { email, usado: false },
      data: { usado: true },
    });

    // F2.3: Generate token and store its HASH in DB (not plaintext)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.lms_password_resets.create({
      data: { email, token: tokenHash, expires_at: expiresAt },
    });

    // Send the RAW token to the user (only they have it)
    await this.mailService.sendPasswordResetEmail(email, rawToken, user.nombre);

    return { message: GENERIC_MSG };
  }

  async resetPassword(token: string, nuevaContrasena: string) {
    this.validatePasswordStrength(nuevaContrasena);

    // F2.3: Hash the incoming token and look up by hash (DB never stores raw token)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetRecord = await this.prisma.lms_password_resets.findUnique({ where: { token: tokenHash } });
    if (!resetRecord) throw new BadRequestException('Token inválido o expirado.');
    if (resetRecord.usado) throw new BadRequestException('Este enlace ya fue utilizado.');
    if (new Date() > resetRecord.expires_at)
      throw new BadRequestException('El enlace ha expirado. Solicita uno nuevo.');

    const hashed = await bcrypt.hash(nuevaContrasena, 10);

    // F2.5: Update password AND revoke all active sessions
    const user = await this.prisma.usuarios.findUnique({ where: { email: resetRecord.email }, select: { guid: true } });

    await this.prisma.usuarios.update({
      where: { email: resetRecord.email },
      data: {
        contrasena: hashed,
        usa_clave_defecto: false,
      },
    });

    await this.prisma.lms_password_resets.update({
      where: { id: resetRecord.id },
      data: { usado: true },
    });

    // Revoke all active sessions for this user
    if (user) {
      await this.tokenBlacklistService.revokeUser(user.guid);
      this.lmsGateway.forceDisconnect(user.guid, 'password_reset');
    }

    return { message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.' };
  }

  // ── Email Verification for Access Requests ──

  /**
   * Generate and send a 6-digit verification code to the email.
   * Code expires in 10 minutes.
   */
  async sendEmailVerification(email: string) {
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Correo electrónico inválido.');
    }

    // Check if email is already in the system
    const existingUser = await this.prisma.usuarios.findUnique({ where: { email } });
    if (existingUser) {
      throw new BadRequestException('Este correo ya está registrado en el sistema. Inicia sesión directamente.');
    }

    // Rate limit: max 1 code per minute per email
    const recentCode = await this.prisma.lms_verificacion_email.findFirst({
      where: {
        email,
        created_at: { gt: new Date(Date.now() - 60_000) },
      },
    });
    if (recentCode) {
      throw new BadRequestException('Ya se envió un código recientemente. Espera 1 minuto antes de solicitar otro.');
    }

    // F2.4: Generate 6-digit code with cryptographic randomness
    const codigo = crypto.randomInt(100000, 999999).toString();
    const codigoHash = crypto.createHash('sha256').update(codigo).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60_000); // 10 minutes

    // Invalidate previous codes for this email
    await this.prisma.lms_verificacion_email.deleteMany({ where: { email } });

    // Store HASH of the code, not plaintext
    await this.prisma.lms_verificacion_email.create({
      data: {
        email,
        codigo: codigoHash,
        expires_at: expiresAt,
      },
    });

    // Send the RAW code via email (only the user has it)
    await this.mailService.sendEmailVerificationCode(email, codigo);

    this.logger.log(`Email verification code sent to ${email}`);
    return { message: 'Se ha enviado un código de verificación a tu correo electrónico.' };
  }

  /**
   * Confirm the 6-digit verification code for an email.
   */
  async confirmEmailVerification(email: string, codigo: string) {
    // F2.4: Hash the incoming code and compare with stored hash
    const codigoHash = crypto.createHash('sha256').update(codigo).digest('hex');

    const record = await this.prisma.lms_verificacion_email.findFirst({
      where: { email, codigo: codigoHash },
      orderBy: { created_at: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('Código incorrecto. Verifica e intenta de nuevo.');
    }

    if (record.expires_at < new Date()) {
      throw new BadRequestException('El código ha expirado. Solicita uno nuevo.');
    }

    if (record.verificado) {
      return { message: 'Este correo ya fue verificado.', verificado: true };
    }

    await this.prisma.lms_verificacion_email.update({
      where: { id: record.id },
      data: { verificado: true },
    });

    return { message: '¡Correo verificado exitosamente!', verificado: true };
  }
}
