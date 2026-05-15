import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { StorageService } from '../storage/storage.service';
import { LmsGateway } from '../ws/lms.gateway';
import * as bcrypt from 'bcryptjs';

/**
 * UserService — User account management (CRUD, profile, stats).
 * Extracted from AuthService to separate user management from authentication flows.
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private tokenBlacklistService: TokenBlacklistService,
    private storageService: StorageService,
    private lmsGateway: LmsGateway,
  ) {}

  async getAllUsers() {
    const users = await this.prisma.usuarios.findMany({
      where: { deleted_at: null },
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
        foto_url: true,
        _count: {
          select: {
            cursos_impartidos: true,
            matriculas: true,
          },
        },
      },
    });

    return users.map((user) => {
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
      where: { estado: 'ACEPTADA' },
    });

    return {
      cuentasAprobadas,
    };
  }

  async deleteUser(guid: string, currentUserGuid?: string) {
    // Prevent self-deletion
    if (currentUserGuid && guid === currentUserGuid) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta.');
    }

    const user = await this.prisma.usuarios.findUnique({ where: { guid } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    if (user.deleted_at) throw new BadRequestException('Este usuario ya fue eliminado.');

    // REVOKE all active JWT tokens for this user BEFORE soft-deleting
    await this.tokenBlacklistService.revokeUser(guid);

    // Reasignar cursos si es PROFESOR o ADMIN para mantener integridad
    if (user.rol === 'PROFESOR' || user.rol === 'ADMINISTRADOR') {
      const fallbackAdmin = await this.prisma.usuarios.findFirst({
        where: { rol: 'ADMINISTRADOR', activo: true, guid: { not: guid }, deleted_at: null },
      });

      if (fallbackAdmin) {
        await this.prisma.lms_cursos.updateMany({
          where: { profesor_guid: guid },
          data: { profesor_guid: fallbackAdmin.guid },
        });
      }
    }

    // SEC: Soft-delete — anonymize PII but preserve data for audit and integrity.
    // Related data (messages, submissions, grades, certificates) stays intact
    // so the other party doesn't lose their records.
    const anonymizedEmail = `deleted-${guid.slice(0, 8)}@removed.local`;
    await this.prisma.usuarios.update({
      where: { guid },
      data: {
        activo: false,
        deleted_at: new Date(),
        // Anonymize PII
        email: anonymizedEmail,
        nombre: 'Usuario',
        apellido: 'Eliminado',
        contrasena: null,
        foto_url: null,
        firma_url: null,
        firma_nombre: null,
        firma_cargo: null,
        invitacion_token_hash: null,
      },
    });

    // Clean up profile photo from storage
    if (user.foto_url) {
      try { await this.storageService.deleteFile(user.foto_url); } catch {}
    }
    if (user.firma_url) {
      try { await this.storageService.deleteFile(user.firma_url); } catch {}
    }

    // Clean up active sessions
    await this.prisma.lms_sesion_activa.deleteMany({ where: { usuario_guid: guid } });

    // Force disconnect the user via WebSocket and notify all clients
    this.lmsGateway.forceDisconnect(guid, 'account_deleted');
    this.lmsGateway.broadcast('user:deleted', { guid, rol: user.rol });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'user_deleted' });

    this.logger.log(`User soft-deleted: ${user.email} (${user.rol}) → ${anonymizedEmail}`);

    return {
      message: 'Cuenta eliminada exitosamente. Los datos históricos se conservan para auditoría.',
      deletedGuid: guid,
    };
  }

  async updateProfile(
    guid: string,
    data: { nombre?: string; apellido?: string; email?: string; contrasena_actual?: string; nueva_contrasena?: string },
  ) {
    const user = await this.prisma.usuarios.findUnique({ where: { guid } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const updateData: any = {};
    if (data.nombre) updateData.nombre = data.nombre;
    if (data.apellido) updateData.apellido = data.apellido;
    // Email is immutable — cannot be changed after account creation

    // Password change
    let passwordChanged = false;
    if (data.nueva_contrasena) {
      if (data.nueva_contrasena.length < 8) {
        throw new BadRequestException('La contraseña debe tener al menos 8 caracteres.');
      }
      if (!data.contrasena_actual) throw new BadRequestException('Debes ingresar tu contraseña actual.');
      if (!user.contrasena) throw new BadRequestException('No tienes contraseña configurada.');
      const valid = await bcrypt.compare(data.contrasena_actual, user.contrasena);
      if (!valid) throw new BadRequestException('La contraseña actual es incorrecta.');
      updateData.contrasena = await bcrypt.hash(data.nueva_contrasena, 10);
      updateData.usa_clave_defecto = false;
      passwordChanged = true;
    }

    const updated = await this.prisma.usuarios.update({
      where: { guid },
      data: updateData,
    });

    this.lmsGateway.broadcast('user:updated', { guid: updated.guid });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'user_updated' });

    // If password changed: revoke old tokens, issue a fresh one for the current session
    if (passwordChanged) {
      // Revoke all existing tokens — old sessions (other devices) will be rejected on:
      // - Next API call → 401 → redirect to login
      // - Next WS reconnect → gateway checks isRevoked → connection refused
      // We intentionally do NOT call forceDisconnect here because it would close
      // the current session's WebSocket before the HTTP response arrives with the new token.
      await this.tokenBlacklistService.revokeUser(guid);

      // Issue a fresh JWT for the current session (post-revocation, so it won't be blacklisted)
      const newToken = this.jwtService.sign({
        sub: updated.guid,
        email: updated.email,
        role: updated.rol,
      });

      this.logger.log(`Password changed for user ${updated.email} — new token issued, old sessions revoked.`);

      return {
        message: 'Contraseña actualizada exitosamente.',
        passwordChanged: true,
        token: newToken,
        user: {
          guid: updated.guid,
          role: updated.rol,
          nombre: updated.nombre,
          apellido: updated.apellido,
          email: updated.email,
        },
      };
    }

    return {
      message: 'Perfil actualizado exitosamente.',
      user: {
        guid: updated.guid,
        role: updated.rol,
        nombre: updated.nombre,
        apellido: updated.apellido,
        email: updated.email,
      },
    };
  }

  async getUserProfile(guid: string) {
    const user = await this.prisma.usuarios.findUnique({
      where: { guid },
      select: { guid: true, email: true, nombre: true, apellido: true, rol: true, created_at: true, foto_url: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return user;
  }

  /**
   * Upload or replace the user's profile photo.
   * Deletes the previous photo from R2/local storage to save resources.
   */
  async uploadProfilePhoto(guid: string, buffer: Buffer, originalName: string) {
    const user = await this.prisma.usuarios.findUnique({ where: { guid }, select: { foto_url: true } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    // Delete old photo if exists
    if (user.foto_url) {
      try {
        await this.storageService.deleteFile(user.foto_url);
        this.logger.log(`Deleted old profile photo: ${user.foto_url}`);
      } catch (err) {
        this.logger.warn(`Failed to delete old profile photo: ${user.foto_url}`, err);
      }
    }

    // Upload new photo
    const filename = await this.storageService.uploadFromBuffer(buffer, originalName, 'avatars');

    await this.prisma.usuarios.update({
      where: { guid },
      data: { foto_url: filename },
    });

    this.lmsGateway.broadcast('user:updated', { guid });
    return { message: 'Foto de perfil actualizada.', foto_url: filename };
  }

  /**
   * Delete the user's profile photo from storage and clear the DB field.
   */
  async deleteProfilePhoto(guid: string) {
    const user = await this.prisma.usuarios.findUnique({ where: { guid }, select: { foto_url: true } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    if (!user.foto_url) throw new BadRequestException('No tienes foto de perfil.');

    try {
      await this.storageService.deleteFile(user.foto_url);
      this.logger.log(`Deleted profile photo: ${user.foto_url}`);
    } catch (err) {
      this.logger.warn(`Failed to delete profile photo: ${user.foto_url}`, err);
    }

    await this.prisma.usuarios.update({
      where: { guid },
      data: { foto_url: null },
    });

    this.lmsGateway.broadcast('user:updated', { guid });
    return { message: 'Foto de perfil eliminada.' };
  }

  /**
   * Create a user account directly (admin only).
   * F1.2/F2.9: Creates user WITHOUT password — generates a one-time invitation token
   * that the user must use to set their first password.
   */
  async createUser(data: { nombre: string; apellido: string; email: string; rol: string }) {
    const existing = await this.prisma.usuarios.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new BadRequestException('Ya existe un usuario con este correo electrónico.');
    }

    // F2.9: Generate a one-time invitation token
    const crypto = await import('crypto');
    const rawInvitationToken = crypto.randomBytes(32).toString('hex');
    const invitationTokenHash = crypto.createHash('sha256').update(rawInvitationToken).digest('hex');

    const user = await this.prisma.usuarios.create({
      data: {
        email: data.email,
        nombre: data.nombre,
        apellido: data.apellido,
        rol: data.rol as any,
        contrasena: null,
        usa_clave_defecto: true,
        invitacion_token_hash: invitationTokenHash,
      },
    });

    this.lmsGateway.broadcast('user:created', { guid: user.guid });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'user_created' });

    this.logger.log(`Admin created user: ${data.email} (${data.rol})`);

    return {
      message: `Usuario ${data.nombre} ${data.apellido} creado. Deberá usar el token de invitación para configurar su contraseña.`,
      user: { guid: user.guid, email: user.email, nombre: user.nombre, apellido: user.apellido, rol: user.rol },
      invitacionToken: rawInvitationToken, // Admin can share this with the user
    };
  }
}
