import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

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
      throw new BadRequestException('Ya existe una solicitud pendiente con este correo.');
    }

    const sol = await this.prisma.lms_solicitudes_acceso.create({
      data: {
        email: dto.email,
        nombre: dto.nombre,
        apellido: dto.apellido,
        rol_pedido: dto.rol_pedido,
      }
    });

    return { message: 'Solicitud enviada al administrador exitosamente.', request_id: sol.id };
  }

  async login(email: string, contrasena?: string) {
    const user = await this.prisma.usuarios.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas.');
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

    // Generate dummy JWT for UI
    const token = Buffer.from(JSON.stringify({ guid: user.guid, role: user.rol, email: user.email })).toString('base64');
    
    return {
      message: 'Inicio de sesión exitoso.',
      token,
      user: { guid: user.guid, role: user.rol, nombre: user.nombre, apellido: user.apellido }
    };
  }

  async setupPassword(email: string, nuevaContrasena: string) {
    const user = await this.prisma.usuarios.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Usuario no existe.');
    }

    if (user.contrasena) {
      const defaultPwd = await this.getDefaultPassword();
      const isDefault = await bcrypt.compare(defaultPwd, user.contrasena);
      if (!isDefault) {
        throw new BadRequestException('La cuenta ya tiene una contraseña configurada y no es la temporal.');
      }
    }

    const hashed = await bcrypt.hash(nuevaContrasena, 10);
    await this.prisma.usuarios.update({
      where: { email },
      data: { contrasena: hashed }
    });

    return { message: 'Contraseña establecida exitosamente.' };
  }

  // --- MÉTODOS DE ADMINISTRADOR ---

  async getAllUsers() {
    return this.prisma.usuarios.findMany({
      orderBy: { created_at: 'desc' }
    });
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

  async rejectRequest(id: number) {
    const request = await this.prisma.lms_solicitudes_acceso.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Solicitud no encontrada.');
    if (request.estado !== 'PENDIENTE') throw new BadRequestException('La solicitud ya fue procesada.');

    await this.prisma.lms_solicitudes_acceso.update({
      where: { id },
      data: { estado: 'RECHAZADA' }
    });

    return { message: 'Solicitud rechazada.' };
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

    return { message: 'Perfil actualizado exitosamente.', user: { guid: updated.guid, role: updated.rol, nombre: updated.nombre, apellido: updated.apellido, email: updated.email } };
  }

  async getUserProfile(guid: string) {
    const user = await this.prisma.usuarios.findUnique({ where: { guid }, select: { guid: true, email: true, nombre: true, apellido: true, rol: true, created_at: true } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return user;
  }
}
