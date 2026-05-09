import { Injectable, Logger, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { LmsGateway } from '../ws/lms.gateway';
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

  // Helper: obtener la contraseña por defecto desde la configuración
  private async getDefaultPassword(): Promise<string> {
    const config = await this.prisma.lms_configuracion.findUnique({ where: { id: 1 } });
    return config?.contrasena_defecto || 'pesvauth2026';
  }

  async requestAccess(dto: { email: string; nombre: string; apellido: string; rol_pedido: any }) {
    const existingUser = await this.prisma.usuarios.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      throw new BadRequestException('El usuario ya existe en el sistema.');
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
      }
    });

    // Notify admins about new access request
    this.lmsGateway.broadcastToRole('request:new', {
      id: sol.id,
      email: dto.email,
      nombre: dto.nombre,
      apellido: dto.apellido,
      rol_pedido: dto.rol_pedido,
    }, 'ADMINISTRADOR');

    // Fire-and-forget: email all active admins (don't block response)
    this.prisma.usuarios.findMany({
      where: { rol: 'ADMINISTRADOR', activo: true },
      select: { email: true, nombre: true },
    }).then(admins => {
      Promise.all(admins.map(admin =>
        this.mailService.sendNewAccessRequest(admin.email, admin.nombre, {
          nombre: dto.nombre, apellido: dto.apellido, email: dto.email, rol_pedido: dto.rol_pedido,
        })
      )).catch(err => this.logger.error('Admin email error:', err));
    });

    return { message: 'Solicitud enviada al administrador exitosamente.', request_id: sol.id };
  }

  async login(email: string, contrasena: string) {
    const user = await this.prisma.usuarios.findUnique({ where: { email } });
    if (!user) {
      const request = await this.prisma.lms_solicitudes_acceso.findUnique({ where: { email } });
      if (request && request.estado === 'PENDIENTE') {
        throw new UnauthorizedException('Aún está en espera de autorización.');
      }
      throw new UnauthorizedException('El usuario no está registrado.');
    }

    if (!contrasena) {
      throw new UnauthorizedException('Contraseña requerida.');
    }

    if (!user.contrasena) {
      return { 
        requireSetup: true, 
        message: 'Cuenta aprobada. Por favor, crea tu contraseña segura.',
        user: { email: user.email, nombre: user.nombre }
      };
    }

    const isValid = await bcrypt.compare(contrasena, user.contrasena);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const defaultPwd = await this.getDefaultPassword();
    if (contrasena === defaultPwd) {
      return { 
        requireSetup: true, 
        message: 'Estás usando la contraseña temporal. Por favor, crea tu contraseña segura.',
        user: { email: user.email, nombre: user.nombre }
      };
    }

    const payload = { sub: user.guid, role: user.rol, email: user.email };
    const token = await this.jwtService.signAsync(payload);
    
    return {
      message: 'Inicio de sesión exitoso.',
      token,
      user: { guid: user.guid, role: user.rol, nombre: user.nombre, apellido: user.apellido }
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
      const defaultPwd = await this.getDefaultPassword();
      if (contrasenaTemporal !== defaultPwd) {
        throw new UnauthorizedException('La contraseña temporal es incorrecta.');
      }
    } else {
      const isTempValid = await bcrypt.compare(contrasenaTemporal, user.contrasena);
      if (!isTempValid) {
        throw new UnauthorizedException('La contraseña temporal es incorrecta.');
      }

      if (!user.usa_clave_defecto) {
        throw new BadRequestException('La cuenta ya tiene una contraseña personalizada. Usa la opción de cambiar contraseña desde tu perfil.');
      }
    }

    const hashed = await bcrypt.hash(nuevaContrasena, 10);
    const updatedUser = await this.prisma.usuarios.update({
      where: { email },
      data: { contrasena: hashed, usa_clave_defecto: false }
    });

    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'user_password_setup' });

    const payload = { sub: updatedUser.guid, role: updatedUser.rol, email: updatedUser.email };
    const token = await this.jwtService.signAsync(payload);

    return {
      message: 'Contraseña establecida exitosamente.',
      token,
      user: { guid: updatedUser.guid, role: updatedUser.rol, nombre: updatedUser.nombre, apellido: updatedUser.apellido }
    };
  }

  // --- ACCESS REQUEST MANAGEMENT ---

  async getPendingRequests() {
    return this.prisma.lms_solicitudes_acceso.findMany({
      where: { estado: 'PENDIENTE' },
      orderBy: { created_at: 'desc' }
    });
  }

  async approveRequest(id: number) {
    const request = await this.prisma.lms_solicitudes_acceso.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Solicitud no encontrada.');
    if (request.estado !== 'PENDIENTE') throw new BadRequestException('La solicitud ya fue procesada.');

    const defaultPwd = await this.getDefaultPassword();
    const hashedDefault = await bcrypt.hash(defaultPwd, 10);

    await this.prisma.$transaction([
      this.prisma.lms_solicitudes_acceso.update({
        where: { id },
        data: { estado: 'ACEPTADA' }
      }),
      this.prisma.usuarios.create({
        data: {
          email: request.email,
          nombre: request.nombre,
          apellido: request.apellido,
          rol: request.rol_pedido,
          contrasena: hashedDefault
        }
      })
    ]);

    // BUG-08 FIX: Send welcome email with temp password (fire-and-forget)
    this.mailService.sendWelcomeEmail(request.email, request.nombre, defaultPwd)
      .catch(err => this.logger.error('Welcome email error:', err));

    return { message: 'Solicitud aprobada y usuario creado con clave temporal.' };
  }

  /**
   * Notify via WebSocket after approve/reject outside the transaction.
   */
  notifyRequestResolved(action: 'approved' | 'rejected', requestData?: any): void {
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
      where: { id }
    });

    return { message: 'Solicitud rechazada y eliminada de la base de datos.' };
  }

  // --- PASSWORD RECOVERY ---

  async requestPasswordReset(email: string) {
    const user = await this.prisma.usuarios.findUnique({ where: { email } });
    if (!user) {
      return { message: 'Si el correo está registrado, recibirás un enlace de recuperación.' };
    }

    await this.prisma.lms_password_resets.updateMany({
      where: { email, usado: false },
      data: { usado: true },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.lms_password_resets.create({
      data: { email, token, expires_at: expiresAt },
    });

    await this.mailService.sendPasswordResetEmail(email, token, user.nombre);

    return { message: 'Si el correo está registrado, recibirás un enlace de recuperación.' };
  }

  async resetPassword(token: string, nuevaContrasena: string) {
    this.validatePasswordStrength(nuevaContrasena);

    const resetRecord = await this.prisma.lms_password_resets.findUnique({ where: { token } });
    if (!resetRecord) throw new BadRequestException('Token inválido o expirado.');
    if (resetRecord.usado) throw new BadRequestException('Este enlace ya fue utilizado.');
    if (new Date() > resetRecord.expires_at) throw new BadRequestException('El enlace ha expirado. Solicita uno nuevo.');

    const hashed = await bcrypt.hash(nuevaContrasena, 10);
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

    const user = await this.prisma.usuarios.findUnique({ where: { email: resetRecord.email }, select: { guid: true } });
    if (user) {
      this.lmsGateway.forceDisconnect(user.guid, 'password_reset');
    }

    return { message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.' };
  }
}
