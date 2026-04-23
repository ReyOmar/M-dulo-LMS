import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConfiguracionService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

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
          mensaje_bienvenida: 'Bienvenido PESV',
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
    return this.prisma.lms_configuracion.update({
      where: { id: 1 },
      data: dto,
    });
  }
}
