import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { LmsGateway } from '../ws/lms.gateway';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private tokenBlacklistService: TokenBlacklistService,
    private lmsGateway: LmsGateway,
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

  async setupPassword(email: string, contrasenaTemporal: string, nuevaContrasena: string) {
    const user = await this.prisma.usuarios.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Usuario no existe.');
    }

    if (!user.contrasena) {
       throw new BadRequestException('La cuenta no tiene contraseña configurada. Contacte a soporte.');
    }

    // Verify the temporary password
    const isTempValid = await bcrypt.compare(contrasenaTemporal, user.contrasena);
    if (!isTempValid) {
      throw new UnauthorizedException('La contraseña temporal es incorrecta.');
    }

    // Check if it's actually the default password (only allow setup if it is the default)
    const defaultPwd = await this.getDefaultPassword();
    const isDefault = await bcrypt.compare(defaultPwd, user.contrasena);
    if (!isDefault) {
      throw new BadRequestException('La cuenta ya tiene una contraseña personalizada y no es la temporal.');
    }

    const hashed = await bcrypt.hash(nuevaContrasena, 10);
    await this.prisma.usuarios.update({
      where: { email },
      data: { contrasena: hashed }
    });

    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'user_password_setup' });

    return { message: 'Contraseña establecida exitosamente.' };
  }

  // --- MÉTODOS DE ADMINISTRADOR ---

  async getAllUsers() {
    const defaultPwd = await this.getDefaultPassword();
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
        contrasena: true,
        _count: {
          select: {
            cursos_impartidos: true,
            matriculas: true,
          }
        }
      }
    });

    return Promise.all(users.map(async user => {
      const { contrasena, _count, activo: dbActivo, ...rest } = user;
      const usa_clave_defecto = contrasena ? await bcrypt.compare(defaultPwd, contrasena) : true;
      
      let computedActivo = dbActivo;
      if (user.rol === 'PROFESOR') {
        computedActivo = _count.cursos_impartidos > 0;
      } else if (user.rol === 'ESTUDIANTE') {
        computedActivo = _count.matriculas > 0;
      }

      return {
        ...rest,
        activo: computedActivo,
        usa_clave_defecto
      };
    }));
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
      if (!data.contrasena_actual) throw new BadRequestException('Debes ingresar tu contraseña actual.');
      if (!user.contrasena) throw new BadRequestException('No tienes contraseña configurada.');
      const valid = await bcrypt.compare(data.contrasena_actual, user.contrasena);
      if (!valid) throw new BadRequestException('La contraseña actual es incorrecta.');
      updateData.contrasena = await bcrypt.hash(data.nueva_contrasena, 10);
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
}
