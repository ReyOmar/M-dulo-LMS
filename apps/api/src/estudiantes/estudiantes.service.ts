import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CertificadosService } from '../certificados/certificados.service';

const AUTO_UNLOCK_HOURS = 48;

@Injectable()
export class EstudiantesService {
  private readonly logger = new Logger(EstudiantesService.name);
  constructor(
    private prisma: PrismaService,
    private certificadosService: CertificadosService,
  ) {}

  async getProgresoEstudiante(usuario_guid: string, curso_guid: string) {
    const curso = await this.prisma.lms_cursos.findUnique({
      where: { guid: curso_guid },
      include: {
        modulos: {
          orderBy: { orden: 'asc' },
          include: {
            lecciones: {
              include: {
                recursos: { orderBy: { orden: 'asc' }, select: { guid: true, tipo: true, titulo: true } }
              }
            }
          }
        }
      }
    });
    if (!curso) return { completados: [], desbloqueados_por_tiempo: [], tareas_pendientes_calificacion: [], total_recursos: 0 };

    const allRecursos = curso.modulos.flatMap((m: any) =>
      m.lecciones.flatMap((l: any) => l.recursos)
    );
    const recursoGuids = allRecursos.map((r: any) => r.guid);
    const tareaGuids = allRecursos.filter((r: any) => r.tipo === 'TAREA').map((r: any) => r.guid);

    // Fetch real completions
    const progreso = await this.prisma.lms_progreso_recurso.findMany({
      where: { usuario_guid, recurso_guid: { in: recursoGuids } }
    });
    const completados = progreso.map((p: any) => p.recurso_guid);

    // Fetch pending submissions (ENTREGADA or EN_REVISION, not yet CALIFICADA)
    const entregasPendientes = tareaGuids.length > 0
      ? await this.prisma.lms_entregas.findMany({
          where: {
            usuario_guid,
            tarea_guid: { in: tareaGuids },
            estado: { in: ['ENTREGADA', 'EN_REVISION'] },
          },
          select: { tarea_guid: true, fecha_entrega: true, respuesta_texto: true },
        })
      : [];

    const now = Date.now();
    const unlockThreshold = AUTO_UNLOCK_HOURS * 60 * 60 * 1000;

    // Resources auto-unlocked because submission is >48h old and still pending
    const desbloqueados_por_tiempo: string[] = [];
    const tareas_pendientes_calificacion: { recurso_guid: string; tarea_titulo: string; fecha_entrega: string }[] = [];

    for (const entrega of entregasPendientes) {
      if (!entrega.tarea_guid || !entrega.fecha_entrega) continue;
      const recursoInfo = allRecursos.find((r: any) => r.guid === entrega.tarea_guid);
      const elapsed = now - new Date(entrega.fecha_entrega).getTime();

      // Track pending tasks for certificate blocking info
      tareas_pendientes_calificacion.push({
        recurso_guid: entrega.tarea_guid,
        tarea_titulo: recursoInfo?.titulo || 'Tarea',
        fecha_entrega: entrega.fecha_entrega.toISOString(),
      });

      // Auto-unlock if >48h and not already marked as completed
      if (elapsed >= unlockThreshold && !completados.includes(entrega.tarea_guid)) {
        desbloqueados_por_tiempo.push(entrega.tarea_guid);
      }
    }

    return {
      completados,
      desbloqueados_por_tiempo,
      tareas_pendientes_calificacion,
      total_recursos: recursoGuids.length,
    };
  }

  async marcarRecursoCompletado(usuario_guid: string, recurso_guid: string) {
    const result = await this.prisma.lms_progreso_recurso.upsert({
      where: { usuario_guid_recurso_guid: { usuario_guid, recurso_guid } },
      create: { usuario_guid, recurso_guid, completado: true },
      update: {},
    });

    // ── Auto-detect course completion and generate certificate ──
    // Fire-and-forget: don't block the student's response
    this.checkAndGenerateCertificate(usuario_guid, recurso_guid).catch((err) => {
      this.logger.error('Auto-certificate check error:', err?.message || err);
    });

    return result;
  }

  /**
   * Check if completing this resource means the entire course is done.
   * If so, automatically generate the certificate (only if all tasks are graded).
   */
  private async checkAndGenerateCertificate(usuario_guid: string, recurso_guid: string) {
    const recurso = await this.prisma.lms_recursos.findUnique({
      where: { guid: recurso_guid },
      select: {
        leccion: {
          select: {
            modulo: {
              select: { curso_guid: true }
            }
          }
        }
      }
    });
    if (!recurso) return;

    const curso_guid = recurso.leccion.modulo.curso_guid;

    const existingCert = await this.prisma.lms_certificados.findUnique({
      where: { usuario_guid_curso_guid: { usuario_guid, curso_guid } },
    });
    if (existingCert) return;

    // Verify full course completion INCLUDING grading status
    const result = await this.certificadosService.verificarCursoCompleto(usuario_guid, curso_guid);
    if (!result.completo || !result.puede_generar_certificado) return;

    await this.certificadosService.generarCertificado(usuario_guid, curso_guid);
    this.logger.log(`Auto-generated certificate for user ${usuario_guid} in course ${curso_guid}`);
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
    const [metricas, matriculas] = await Promise.all([
      this.prisma.lms_metricas_capacitacion.upsert({
        where: { usuario_guid },
        create: { usuario_guid },
        update: {},
      }),
      this.prisma.lms_matriculas.findMany({
        where: { usuario_guid },
        include: {
          curso: {
            include: {
              modulos: {
                include: {
                  lecciones: {
                    include: {
                      recursos: { select: { guid: true } }
                    }
                  }
                }
              }
            }
          }
        }
      }),
    ]);

    const allResourceGuids: string[] = [];
    const courseTotals: { courseIndex: number; guids: string[] }[] = [];

    for (let i = 0; i < matriculas.length; i++) {
      const recursoGuids = matriculas[i].curso.modulos.flatMap((m: any) =>
        m.lecciones.flatMap((l: any) => l.recursos.map((r: any) => r.guid))
      );
      allResourceGuids.push(...recursoGuids);
      courseTotals.push({ courseIndex: i, guids: recursoGuids });
    }

    const completedSet = new Set<string>();
    if (allResourceGuids.length > 0) {
      const completed = await this.prisma.lms_progreso_recurso.findMany({
        where: { usuario_guid, recurso_guid: { in: allResourceGuids } },
        select: { recurso_guid: true },
      });
      for (const c of completed) completedSet.add(c.recurso_guid);
    }

    let cursos_completados = 0;
    const total_recursos_completados = completedSet.size;

    for (const ct of courseTotals) {
      if (ct.guids.length === 0) continue;
      const courseCompleted = ct.guids.filter(g => completedSet.has(g)).length;
      if (courseCompleted === ct.guids.length) cursos_completados++;
    }

    // Use real session time from lms_sesion_activa
    const sessionAggregate = await this.prisma.lms_sesion_activa.aggregate({
      where: { usuario_guid },
      _sum: { duracion_seg: true },
    });
    const horasReales = (sessionAggregate._sum.duracion_seg || 0) / 3600;

    return {
      ...metricas,
      cursos_completados,
      total_cursos: matriculas.length,
      total_horas_invertidas: Math.round(horasReales * 10) / 10
    };
  }

  /**
   * Register a heartbeat for active time tracking.
   * Called every 60 seconds from the course viewer while the tab is visible.
   * If last heartbeat was < 2 min ago, extend the session. Otherwise create a new one.
   */
  async registrarHeartbeat(usuario_guid: string, curso_guid: string) {
    const HEARTBEAT_INTERVAL = 60; // seconds
    const SESSION_TIMEOUT = 120; // seconds - if gap > 2min, start new session
    const cutoff = new Date(Date.now() - SESSION_TIMEOUT * 1000);

    // Find the most recent active session
    const lastSession = await this.prisma.lms_sesion_activa.findFirst({
      where: {
        usuario_guid,
        curso_guid,
        fin_sesion: { gte: cutoff },
      },
      orderBy: { fin_sesion: 'desc' },
    });

    if (lastSession) {
      // Extend existing session
      await this.prisma.lms_sesion_activa.update({
        where: { id: lastSession.id },
        data: {
          fin_sesion: new Date(),
          duracion_seg: lastSession.duracion_seg + HEARTBEAT_INTERVAL,
        },
      });
    } else {
      // Start new session
      await this.prisma.lms_sesion_activa.create({
        data: {
          usuario_guid,
          curso_guid,
          inicio_sesion: new Date(),
          fin_sesion: new Date(),
          duracion_seg: HEARTBEAT_INTERVAL,
        },
      });
    }

    return { ok: true };
  }

  /**
   * Get total active time for a user in a course (in seconds).
   */
  async getTiempoActivoCurso(usuario_guid: string, curso_guid: string): Promise<number> {
    const result = await this.prisma.lms_sesion_activa.aggregate({
      where: { usuario_guid, curso_guid },
      _sum: { duracion_seg: true },
    });
    return result._sum.duracion_seg || 0;
  }
}
