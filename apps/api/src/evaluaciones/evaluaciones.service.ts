import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { lms_estado_entrega } from '@prisma/client';
import { LmsGateway } from '../ws/lms.gateway';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { MailService } from '../mail/mail.service';
import { CertificadosService } from '../certificados/certificados.service';

@Injectable()
export class EvaluacionesService {
  private readonly logger = new Logger(EvaluacionesService.name);
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private lmsGateway: LmsGateway,
    private notificacionesService: NotificacionesService,
    private mailService: MailService,
    private certificadosService: CertificadosService,
  ) {}

  async submitEntrega(tarea_guid: string, data: { buffer: Buffer, nombre_archivo: string, usuario_guid: string }) {
    const serverFilename = await this.storageService.uploadFromBuffer(data.buffer, data.nombre_archivo);

    let entrega = await this.prisma.lms_entregas.findFirst({
        where: { tarea_guid, usuario_guid: data.usuario_guid }
    });

    if (entrega) {
        // Check if this is a re-submission after a low grade
        const previousGrade = entrega.contenido_texto?.startsWith('NOTA:') 
          ? parseFloat(entrega.contenido_texto.replace('NOTA: ', '').split(' | ')[0])
          : null;
        const isResubmission = entrega.estado === 'CALIFICADA' && previousGrade !== null && previousGrade < 3;

        entrega = await this.prisma.lms_entregas.update({
            where: { guid: entrega.guid },
            data: {
                url_archivo_adjunto: serverFilename,
                respuesta_texto: data.nombre_archivo,
                estado: isResubmission ? 'EN_REVISION' : 'ENTREGADA',
                fecha_entrega: new Date()
            }
        });

        // If re-submission, notify the examiner
        if (isResubmission && entrega.tarea_guid) {
          const recurso = await this.prisma.lms_recursos.findUnique({
            where: { guid: entrega.tarea_guid },
            select: {
              titulo: true,
              leccion: { select: { modulo: { select: { curso: { select: { titulo: true, profesor_guid: true } } } } } },
            },
          });
          if (recurso) {
            const estudiante = await this.prisma.usuarios.findUnique({ where: { guid: data.usuario_guid }, select: { nombre: true, apellido: true } });
            const nombreEstudiante = estudiante ? `${estudiante.nombre} ${estudiante.apellido}` : 'Estudiante';
            await this.notificacionesService.crearNotificacion({
              usuario_guid: recurso.leccion.modulo.curso.profesor_guid,
              tipo: 'REVISION_ENTREGA',
              titulo: 'Nueva entrega para revisión',
              mensaje: `${nombreEstudiante} ha re-entregado "${recurso.titulo}" del curso "${recurso.leccion.modulo.curso.titulo}". La entrega anterior obtuvo ${previousGrade?.toFixed(1)}/5.0.`,
              ref_tipo: 'entrega',
              ref_guid: entrega.guid,
            });
          }
        }
    } else {
        entrega = await this.prisma.lms_entregas.create({
            data: {
                tarea_guid,
                usuario_guid: data.usuario_guid,
                url_archivo_adjunto: serverFilename,
                respuesta_texto: data.nombre_archivo,
                estado: 'ENTREGADA',
                fecha_entrega: new Date()
            }
        });
    }

    // Notify teachers/admins about the new submission (not students)
    this.lmsGateway.broadcastToRole('submission:new', { 
      tarea_guid, 
      usuario_guid: data.usuario_guid,
      estado: 'ENTREGADA'
    }, 'PROFESOR');
    this.lmsGateway.broadcastToRole('submission:new', { 
      tarea_guid, 
      usuario_guid: data.usuario_guid,
      estado: 'ENTREGADA'
    }, 'ADMINISTRADOR');
    this.lmsGateway.broadcastToRole('dashboard:refresh', { reason: 'submission_new' }, 'PROFESOR');
    this.lmsGateway.broadcastToRole('dashboard:refresh', { reason: 'submission_new' }, 'ADMINISTRADOR');

    return entrega;
  }

  async getEntrega(tarea_guid: string, usuario_guid: string) {
    return this.prisma.lms_entregas.findFirst({
        where: { tarea_guid, usuario_guid },
        select: {
            guid: true,
            estado: true,
            fecha_entrega: true,
            respuesta_texto: true,
            url_archivo_adjunto: true,
            contenido_texto: true,
        }
    });
  }

  async getTodasEntregasParaTarea(tarea_guid: string) {
    return this.prisma.lms_entregas.findMany({
        where: { tarea_guid },
        select: {
            guid: true,
            estado: true,
            fecha_entrega: true,
            respuesta_texto: true,
            usuario_guid: true,
        },
        orderBy: { fecha_entrega: 'desc' }
    });
  }

  async getEntregasParaCalificar(profesor_guid: string) {
    const cursos = await this.prisma.lms_cursos.findMany({
      where: { profesor_guid },
      include: {
        modulos: {
          include: {
            lecciones: {
              include: {
                recursos: {
                  where: { tipo: 'TAREA' },
                  select: { guid: true, titulo: true, archivo_max_size_mb: true }
                }
              }
            }
          }
        }
      }
    });

    const tareaGuids: string[] = [];
    const tareaInfo: Record<string, { titulo: string; curso_titulo: string; curso_guid: string; modulo_titulo: string; modulo_guid: string }> = {};

    for (const curso of cursos) {
      for (const mod of curso.modulos) {
        for (const lec of mod.lecciones) {
          for (const rec of lec.recursos) {
            tareaGuids.push(rec.guid);
            tareaInfo[rec.guid] = { 
              titulo: rec.titulo, 
              curso_titulo: curso.titulo, 
              curso_guid: curso.guid,
              modulo_titulo: mod.titulo,
              modulo_guid: mod.guid
            };
          }
        }
      }
    }

    if (tareaGuids.length === 0) return [];

    const entregas = await this.prisma.lms_entregas.findMany({
      where: { tarea_guid: { in: tareaGuids } },
      orderBy: { fecha_entrega: 'desc' },
      take: 500
    });

    const studentGuids = [...new Set(entregas.map(e => e.usuario_guid))];
    const students = await this.prisma.usuarios.findMany({
      where: { guid: { in: studentGuids } },
      select: { guid: true, nombre: true, apellido: true, email: true }
    });
    const studentMap = Object.fromEntries(students.map(s => [s.guid, s]));

    return entregas.map(e => ({
      guid: e.guid,
      tarea_guid: e.tarea_guid,
      tarea_titulo: tareaInfo[e.tarea_guid || '']?.titulo || 'Sin título',
      curso_titulo: tareaInfo[e.tarea_guid || '']?.curso_titulo || 'Sin curso',
      curso_guid: tareaInfo[e.tarea_guid || '']?.curso_guid || null,
      modulo_titulo: tareaInfo[e.tarea_guid || '']?.modulo_titulo || 'Sin módulo',
      modulo_guid: tareaInfo[e.tarea_guid || '']?.modulo_guid || null,
      estudiante: studentMap[e.usuario_guid] || { nombre: 'Desconocido', apellido: '', email: '' },
      archivo_nombre: e.respuesta_texto,
      archivo_servidor: e.url_archivo_adjunto,
      estado: e.estado,
      fecha_entrega: e.fecha_entrega,
      contenido_texto: e.contenido_texto
    }));
  }

  async calificarEntrega(guid: string, data: { calificacion: number; comentario?: string }) {
    const entrega = await this.prisma.lms_entregas.update({
      where: { guid },
      data: {
        estado: 'CALIFICADA' as lms_estado_entrega,
        contenido_texto: `NOTA: ${data.calificacion}${data.comentario ? ` | ${data.comentario}` : ''}`
      }
    });

    if (data.calificacion >= 3.0 && entrega.tarea_guid) {
      const existing = await this.prisma.lms_progreso_recurso.findUnique({
        where: {
          usuario_guid_recurso_guid: {
            usuario_guid: entrega.usuario_guid,
            recurso_guid: entrega.tarea_guid
          }
        }
      });
      if (!existing) {
        await this.prisma.lms_progreso_recurso.create({
          data: {
            usuario_guid: entrega.usuario_guid,
            recurso_guid: entrega.tarea_guid,
            completado: true
          }
        });
      }
    }

    // Broadcast immediately for real-time UI — only to the affected student
    this.lmsGateway.broadcast('submission:graded', {
      guid, tarea_guid: entrega.tarea_guid,
      calificacion: data.calificacion, usuario_guid: entrega.usuario_guid
    }, [entrega.usuario_guid]);
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'submission_graded' });

    // Fire-and-forget: notifications + email (don't block the response)
    (async () => {
      try {
        const [tareaInfo, estudianteInfo] = await Promise.all([
          entrega.tarea_guid
            ? this.prisma.lms_recursos.findUnique({ where: { guid: entrega.tarea_guid }, select: { titulo: true } })
            : null,
          this.prisma.usuarios.findUnique({ where: { guid: entrega.usuario_guid }, select: { email: true, nombre: true } }),
        ]);
        const tareaTitulo = tareaInfo?.titulo || 'Tarea';

        const notifPromise = data.calificacion < 3.0
          ? this.notificacionesService.crearNotificacion({
              usuario_guid: entrega.usuario_guid,
              tipo: 'ENTREGA_RECHAZADA',
              titulo: 'Calificación insuficiente',
              mensaje: `Tu entrega en "${tareaTitulo}" obtuvo ${data.calificacion.toFixed(1)}/5.0. Debes subir un nuevo documento para mejorar tu nota.${data.comentario ? ` Comentario: ${data.comentario}` : ''}`,
              ref_tipo: 'entrega', ref_guid: guid,
            })
          : this.notificacionesService.crearNotificacion({
              usuario_guid: entrega.usuario_guid,
              tipo: 'TAREA_CALIFICADA',
              titulo: '¡Tarea calificada!',
              mensaje: `Tu entrega en "${tareaTitulo}" obtuvo ${data.calificacion.toFixed(1)}/5.0. ¡Buen trabajo!${data.comentario ? ` Comentario: ${data.comentario}` : ''}`,
              ref_tipo: 'entrega', ref_guid: guid,
            });

        const emailPromise = estudianteInfo
          ? this.mailService.sendGradeNotification(estudianteInfo.email, estudianteInfo.nombre, tareaTitulo, data.calificacion)
          : Promise.resolve();

        await Promise.all([notifPromise, emailPromise]);
      } catch (err) {
        this.logger.error('Grade notification error:', err);
      }
    })();

    // ── Check if this grading completes the course for certificate generation ──
    if (data.calificacion >= 3.0 && entrega.tarea_guid) {
      this.checkCertificateAfterGrading(entrega.usuario_guid, entrega.tarea_guid).catch((err) => {
        this.logger.error('Post-grading certificate check error:', err?.message || err);
      });
    }

    return entrega;
  }

  /**
   * After grading, check if the student has now completed all requirements
   * for a certificate (all resources done + all tasks graded).
   */
  private async checkCertificateAfterGrading(usuario_guid: string, tarea_guid: string) {
    // Find which course this task belongs to
    const recurso = await this.prisma.lms_recursos.findUnique({
      where: { guid: tarea_guid },
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

    // Check if certificate already exists
    const existing = await this.prisma.lms_certificados.findUnique({
      where: { usuario_guid_curso_guid: { usuario_guid, curso_guid } },
    });
    if (existing) return;

    // Verify full completion + all tasks graded
    const result = await this.certificadosService.verificarCursoCompleto(usuario_guid, curso_guid);
    if (!result.completo || !result.puede_generar_certificado) return;

    // All conditions met — auto-generate certificate!
    await this.certificadosService.generarCertificado(usuario_guid, curso_guid);
    this.logger.log(`Certificate auto-generated after grading for user ${usuario_guid} in course ${curso_guid}`);
  }
}
