import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LmsGateway } from '../ws/lms.gateway';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto';

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
          landing_hero_titulo1: 'Transporte Seguro,',
          landing_hero_titulo2: 'Personal Capacitado',
          landing_hero_subtitulo: 'Plataforma integral para la gestión del Plan Estratégico de Seguridad Vial. Capacitación, evaluación y certificación de conductores con tecnología de vanguardia.',
          landing_telefono: '+57 300 123 4567',
          landing_telefono_sub: 'Lun-Vie 8am-6pm',
          landing_email: 'contacto@pesveducation.com',
          landing_email_sub: 'Respuesta en 24h',
          landing_oficina: 'Bogotá, Colombia',
          landing_oficina_sub: 'Cra 7 #45-21, Oficina 302',
          landing_footer_texto: 'Plataforma líder en capacitación y certificación de seguridad vial para empresas de transporte de carga.',
        },
      });
    }
  }

  async getConfig() {
    const config = await this.prisma.lms_configuracion.findUnique({
      where: { id: 1 },
    });
    if (config) {
      // Strip sensitive fields from public response
      const { contrasena_defecto, ...safeConfig } = config as any;
      return safeConfig;
    }
    return config;
  }

  async getFullConfig() {
    return this.prisma.lms_configuracion.findUnique({
      where: { id: 1 },
    });
  }

  async updateConfig(dto: UpdateConfiguracionDto) {
    const updated = await this.prisma.lms_configuracion.update({
      where: { id: 1 },
      data: dto,
    });
    
    this.lmsGateway.broadcast('config:updated', updated);
    return updated;
  }

  async getLandingConfig() {
    return this.prisma.lms_configuracion.findUnique({
      where: { id: 1 },
      select: {
        nombre_plataforma: true,
        logo_url: true,
        color_primario: true,
        color_secundario: true,
        fuente: true,
        border_radius: true,
        landing_hero_titulo1: true,
        landing_hero_titulo2: true,
        landing_hero_subtitulo: true,
        landing_telefono: true,
        landing_telefono_sub: true,
        landing_email: true,
        landing_email_sub: true,
        landing_oficina: true,
        landing_oficina_sub: true,
        landing_footer_texto: true,
        legal_terminos: true,
        legal_privacidad: true,
        legal_datos: true,
      },
    });
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
        cert_mostrar_fecha_ingreso: true,
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
      'cert_mostrar_firma', 'cert_mostrar_fecha_ingreso',
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
