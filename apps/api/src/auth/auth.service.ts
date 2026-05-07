import { Injectable, Logger, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { LmsGateway } from '../ws/lms.gateway';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

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
    // Check if user already exists
    const existingUser = await this.prisma.usuarios.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      throw new BadRequestException('El usuario ya existe en el sistema.');
    }

    // Check if request already exists
    const existingReq = await this.prisma.lms_solicitudes_acceso.findUnique({ where: { email: dto.email } });
    if (existingReq) {
      if (existingReq.estado === 'PENDIENTE') {
        throw new BadRequestException('Ya existe una solicitud pendiente con este correo.');
      } else {
        // Purge old rejected/accepted requests so they can apply again
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

    // Si la contraseña es NULL, fuerza configuración
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

    // Si la contraseña es la predeterminada, fuerza configuración
    const defaultPwd = await this.getDefaultPassword();
    if (contrasena === defaultPwd) {
      return { 
        requireSetup: true, 
        message: 'Estás usando la contraseña temporal. Por favor, crea tu contraseña segura.',
        user: { email: user.email, nombre: user.nombre }
      };
    }

    // Generate signed JWT token
    const payload = { sub: user.guid, role: user.rol, email: user.email };
    const token = await this.jwtService.signAsync(payload);
    
    return {
      message: 'Inicio de sesión exitoso.',
      token,
      user: { guid: user.guid, role: user.rol, nombre: user.nombre, apellido: user.apellido }
    };
  }

  /** Validates password strength: min 8 chars, at least one letter and one number */
  private validatePasswordStrength(password: string): void {
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

    // Case 1: Account created by admin WITHOUT password (contrasena = NULL)
    // Only require the temporary password input to match the system default
    if (!user.contrasena) {
      const defaultPwd = await this.getDefaultPassword();
      if (contrasenaTemporal !== defaultPwd) {
        throw new UnauthorizedException('La contraseña temporal es incorrecta.');
      }
    } else {
      // Case 2: Account has a hashed password — verify it
      const isTempValid = await bcrypt.compare(contrasenaTemporal, user.contrasena);
      if (!isTempValid) {
        throw new UnauthorizedException('La contraseña temporal es incorrecta.');
      }

      // Only allow setup if the current password IS the default
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

    // Auto-login after successful password setup for smooth UX
    const payload = { sub: updatedUser.guid, role: updatedUser.rol, email: updatedUser.email };
    const token = await this.jwtService.signAsync(payload);

    return {
      message: 'Contraseña establecida exitosamente.',
      token,
      user: { guid: updatedUser.guid, role: updatedUser.rol, nombre: updatedUser.nombre, apellido: updatedUser.apellido }
    };
  }

  // --- MÉTODOS DE ADMINISTRADOR ---

  async getAllUsers() {
    const users = await this.prisma.usuarios.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        guid: true,
        email: true,
        nombre: true,
        apellido: true,
        rol: true,
        activo: true,
        created_at: true,
        updated_at: true,
        ultimo_acceso: true,
        usa_clave_defecto: true,
        _count: {
          select: {
            cursos_impartidos: true,
            matriculas: true,
          }
        }
      }
    });

    return users.map(user => {
      const { _count, ...rest } = user;
      return {
        ...rest,
        tiene_cursos: _count.cursos_impartidos,
        tiene_matriculas: _count.matriculas,
      };
    });
  }

  async getAdminStats() {
    const cuentasAprobadas = await this.prisma.lms_solicitudes_acceso.count({
      where: { estado: 'ACEPTADA' }
    });
    
    return {
      cuentasAprobadas
    };
  }

  async deleteUser(guid: string, currentUserGuid?: string) {
    // Prevent self-deletion
    if (currentUserGuid && guid === currentUserGuid) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta.');
    }

    const user = await this.prisma.usuarios.findUnique({ where: { guid } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    // REVOKE all active JWT tokens for this user BEFORE deleting from DB
    this.tokenBlacklistService.revokeUser(guid);

    // Reasignar cursos si es PROFESOR o ADMIN para no borrarlos
    if (user.rol === 'PROFESOR' || user.rol === 'ADMINISTRADOR') {
      const fallbackAdmin = await this.prisma.usuarios.findFirst({
        where: { rol: 'ADMINISTRADOR', activo: true, guid: { not: guid } }
      });
      
      if (fallbackAdmin) {
        await this.prisma.lms_cursos.updateMany({
          where: { profesor_guid: guid },
          data: { profesor_guid: fallbackAdmin.guid }
        });
      }
    }

    // Las entregas no tienen onDelete: Cascade en el schema, así que las borramos manualmente (para estudiantes)
    await this.prisma.lms_entregas.deleteMany({
      where: { usuario_guid: guid }
    });

    await this.prisma.usuarios.delete({ where: { guid } });

    // Force disconnect the user via WebSocket and notify all clients
    this.lmsGateway.forceDisconnect(guid, 'account_deleted');
    this.lmsGateway.broadcast('user:deleted', { guid, rol: user.rol });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'user_deleted' });

    return { message: 'Cuenta eliminada exitosamente. Sus cursos han sido reasignados a otro administrador si los hubiera.', deletedGuid: guid };
  }

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

    // Obtener la clave por defecto de la configuración
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

    return { message: 'Solicitud aprobada y usuario creado con clave temporal.' };
  }

  /**
   * Notify via WebSocket after approve/reject outside the transaction.
   * Called from controller after approveRequest/rejectRequest completes.
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

  async updateProfile(guid: string, data: { nombre?: string; apellido?: string; email?: string; contrasena_actual?: string; nueva_contrasena?: string }) {
    const user = await this.prisma.usuarios.findUnique({ where: { guid } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const updateData: any = {};
    if (data.nombre) updateData.nombre = data.nombre;
    if (data.apellido) updateData.apellido = data.apellido;
    if (data.email && data.email !== user.email) {
      const existing = await this.prisma.usuarios.findUnique({ where: { email: data.email } });
      if (existing) throw new BadRequestException('Este correo ya está en uso.');
      updateData.email = data.email;
    }

    // Password change
    if (data.nueva_contrasena) {
      this.validatePasswordStrength(data.nueva_contrasena);
      if (!data.contrasena_actual) throw new BadRequestException('Debes ingresar tu contraseña actual.');
      if (!user.contrasena) throw new BadRequestException('No tienes contraseña configurada.');
      const valid = await bcrypt.compare(data.contrasena_actual, user.contrasena);
      if (!valid) throw new BadRequestException('La contraseña actual es incorrecta.');
      updateData.contrasena = await bcrypt.hash(data.nueva_contrasena, 10);
      updateData.usa_clave_defecto = false;
      // Force disconnect all active sessions so old tokens can't be reused
      this.lmsGateway.forceDisconnect(guid, 'password_changed');
    }

    const updated = await this.prisma.usuarios.update({
      where: { guid },
      data: updateData
    });

    this.lmsGateway.broadcast('user:updated', { guid: updated.guid });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'user_updated' });

    return { message: 'Perfil actualizado exitosamente.', user: { guid: updated.guid, role: updated.rol, nombre: updated.nombre, apellido: updated.apellido, email: updated.email } };
  }

  async getUserProfile(guid: string) {
    const user = await this.prisma.usuarios.findUnique({ where: { guid }, select: { guid: true, email: true, nombre: true, apellido: true, rol: true, created_at: true } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return user;
  }

  // --- RECUPERACIÓN DE CONTRASEÑA ---

  async requestPasswordReset(email: string) {
    const user = await this.prisma.usuarios.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if user exists — always return success
      return { message: 'Si el correo está registrado, recibirás un enlace de recuperación.' };
    }

    // Invalidate previous tokens for this email
    await this.prisma.lms_password_resets.updateMany({
      where: { email, usado: false },
      data: { usado: true },
    });

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.lms_password_resets.create({
      data: { email, token, expires_at: expiresAt },
    });

    // Send email
    await this.mailService.sendPasswordResetEmail(email, token, user.nombre);

    return { message: 'Si el correo está registrado, recibirás un enlace de recuperación.' };
  }

  async resetPassword(token: string, nuevaContrasena: string) {
    const resetRecord = await this.prisma.lms_password_resets.findUnique({ where: { token } });
    if (!resetRecord) throw new BadRequestException('Token inválido o expirado.');
    if (resetRecord.usado) throw new BadRequestException('Este enlace ya fue utilizado.');
    if (new Date() > resetRecord.expires_at) throw new BadRequestException('El enlace ha expirado. Solicita uno nuevo.');

    // Hash new password
    const hashed = await bcrypt.hash(nuevaContrasena, 10);
    await this.prisma.usuarios.update({
      where: { email: resetRecord.email },
      data: { contrasena: hashed },
    });

    // Mark token as used
    await this.prisma.lms_password_resets.update({
      where: { id: resetRecord.id },
      data: { usado: true },
    });

    // Force disconnect any active sessions for this user
    const user = await this.prisma.usuarios.findUnique({ where: { email: resetRecord.email }, select: { guid: true } });
    if (user) {
      this.lmsGateway.forceDisconnect(user.guid, 'password_reset');
    }

    return { message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.' };
  }
}
