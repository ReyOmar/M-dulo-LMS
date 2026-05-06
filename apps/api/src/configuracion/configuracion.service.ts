import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LmsGateway } from '../ws/lms.gateway';

@Injectable()
export class ConfiguracionService implements OnModuleInit {
  constructor(private prisma: PrismaService, private lmsGateway: LmsGateway) {}

  async onModuleInit() {
    await this.ensureConfig();
  }

  async ensureConfig() {
    const config = await this.prisma.lms_configuracion.findUnique({
      where: { id: 1 },
    });

    if (!config) {
      await this.prisma.lms_configuracion.create({
        data: {
          id: 1,
          nombre_plataforma: 'PESV Education',
          color_primario: '#1e3a8a',
          color_secundario: '#ea580c',
          fuente: 'Inter',
          border_radius: 12,
          mensaje_bienvenida: 'Bienvenido a PESV Education',
          idioma: 'es',
        },
      });
    }
  }

  async getConfig() {
    return this.prisma.lms_configuracion.findUnique({
      where: { id: 1 },
    });
  }

  async updateConfig(dto: any) {
    const updated = await this.prisma.lms_configuracion.update({
      where: { id: 1 },
      data: dto,
    });
    
    this.lmsGateway.broadcast('config:updated', updated);
    return updated;
  }

  async getCertConfig() {
    const config = await this.prisma.lms_configuracion.findUnique({
      where: { id: 1 },
      select: {
        cert_titulo_personalizado: true,
        cert_subtitulo: true,
        cert_texto_legal: true,
        cert_mostrar_modulos: true,
        cert_mostrar_recursos: true,
        cert_mostrar_nota: true,
        cert_mostrar_firma: true,
        nombre_plataforma: true,
        color_primario: true,
        color_secundario: true,
      },
    });
    return config;
  }

  async updateCertConfig(dto: any) {
    // Only allow cert_* fields to be updated
    const allowedFields = [
      'cert_titulo_personalizado', 'cert_subtitulo', 'cert_texto_legal',
      'cert_mostrar_modulos', 'cert_mostrar_recursos', 'cert_mostrar_nota',
      'cert_mostrar_firma',
    ];
    const data: any = {};
    for (const key of allowedFields) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }
    const updated = await this.prisma.lms_configuracion.update({
      where: { id: 1 },
      data,
    });
    this.lmsGateway.broadcast('config:updated', updated);
    return updated;
  }

  // ── Examiner Firma Methods ──

  async getFirma(usuario_guid: string) {
    const user = await this.prisma.usuarios.findUnique({
      where: { guid: usuario_guid },
      select: { firma_url: true, firma_nombre: true, firma_cargo: true, nombre: true, apellido: true },
    });
    return user;
  }

  async updateFirma(usuario_guid: string, dto: { firma_url?: string; firma_nombre?: string; firma_cargo?: string }) {
    const allowedFields = ['firma_url', 'firma_nombre', 'firma_cargo'];
    const data: any = {};
    for (const key of allowedFields) {
      if (dto[key as keyof typeof dto] !== undefined) data[key] = dto[key as keyof typeof dto];
    }
    return this.prisma.usuarios.update({
      where: { guid: usuario_guid },
      data,
      select: { firma_url: true, firma_nombre: true, firma_cargo: true, nombre: true, apellido: true },
    });
  }

  async getFirmaPorCurso(curso_guid: string) {
    const curso = await this.prisma.lms_cursos.findUnique({
      where: { guid: curso_guid },
      select: {
        titulo: true,
        profesor: {
          select: { firma_url: true, firma_nombre: true, firma_cargo: true, nombre: true, apellido: true },
        },
      },
    });
    return curso;
  }
}
