import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EstudiantesService {
  constructor(private prisma: PrismaService) {}

  async getProgresoEstudiante(usuario_guid: string, curso_guid: string) {
    const curso = await this.prisma.lms_cursos.findUnique({
      where: { guid: curso_guid },
      include: {
        modulos: {
          orderBy: { orden: 'asc' },
          include: {
            lecciones: {
              include: {
                recursos: { orderBy: { orden: 'asc' }, select: { guid: true } }
              }
            }
          }
        }
      }
    });
    if (!curso) return { completados: [] };

    const recursoGuids = curso.modulos.flatMap((m: any) =>
      m.lecciones.flatMap((l: any) => l.recursos.map((r: any) => r.guid))
    );

    const progreso = await this.prisma.lms_progreso_recurso.findMany({
      where: { usuario_guid, recurso_guid: { in: recursoGuids } }
    });

    return { completados: progreso.map((p: any) => p.recurso_guid), total_recursos: recursoGuids.length };
  }

  async marcarRecursoCompletado(usuario_guid: string, recurso_guid: string) {
    const existing = await this.prisma.lms_progreso_recurso.findUnique({
      where: { usuario_guid_recurso_guid: { usuario_guid, recurso_guid } }
    });
    if (existing) return existing;

    return this.prisma.lms_progreso_recurso.create({
      data: { usuario_guid, recurso_guid, completado: true }
    });
  }

  async getDiasActivos(usuario_guid: string, year: number, month: number) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);

    const [progresos, entregas] = await Promise.all([
      this.prisma.lms_progreso_recurso.findMany({
        where: { usuario_guid, fecha_completado: { gte: start, lt: end } },
        select: { fecha_completado: true }
      }),
      this.prisma.lms_entregas.findMany({
        where: { usuario_guid, fecha_entrega: { gte: start, lt: end } },
        select: { fecha_entrega: true }
      })
    ]);

    const days = new Set<number>();
    for (const p of progresos) {
      days.add(new Date(p.fecha_completado).getDate());
    }
    for (const e of entregas) {
      if (e.fecha_entrega) days.add(new Date(e.fecha_entrega).getDate());
    }

    return { dias: Array.from(days).sort((a, b) => a - b) };
  }

  async getNotificacionesEstudiante(usuario_guid: string) {
    return this.prisma.lms_notificaciones.findMany({
      where: { usuario_guid },
      orderBy: { created_at: 'desc' },
      take: 20
    });
  }

  async marcarNotificacionLeida(id: number) {
    return this.prisma.lms_notificaciones.update({
      where: { id },
      data: { leida: true }
    });
  }

  async getMetricasEstudiante(usuario_guid: string) {
    let metricas = await this.prisma.lms_metricas_capacitacion.findUnique({
      where: { usuario_guid }
    });
    if (!metricas) {
      metricas = await this.prisma.lms_metricas_capacitacion.create({
        data: { usuario_guid }
      });
    }
    return metricas;
  }
}
