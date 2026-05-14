import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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

  /**
   * Submit or resubmit a student delivery for a task.
   * - First submission: creates new entrega with status ENTREGADA.
   * - Resubmission after failing grade: updates with status EN_REVISION.
   * - BUG-02 FIX: Blocks resubmission if already graded with passing score.
   * @throws BadRequestException if delivery was already approved.
   */
  async submitEntrega(tarea_guid: string, data: { buffer: Buffer; nombre_archivo: string; usuario_guid: string }) {
    const serverFilename = await this.storageService.uploadFromBuffer(data.buffer, data.nombre_archivo, 'entregas');

    let entrega = await this.prisma.lms_entregas.findFirst({
      where: { tarea_guid, usuario_guid: data.usuario_guid },
    });

    if (entrega) {
      // BUG-02 FIX: Block resubmission if the delivery was already graded with a passing score.
      // Look up the course's nota_aprobacion to determine the threshold dynamically.
      const previousGrade = entrega.calificacion != null ? Number(entrega.calificacion) : null;
      let notaAprobacion = 3.0; // safe default
      if (previousGrade !== null) {
        const recurso = await this.prisma.lms_recursos.findUnique({
          where: { guid: tarea_guid },
          select: { leccion: { select: { modulo: { select: { curso: { select: { nota_aprobacion: true } } } } } } },
        });
        if (recurso?.leccion?.modulo?.curso?.nota_aprobacion != null) {
          notaAprobacion = Number(recurso.leccion.modulo.curso.nota_aprobacion);
        }
      }
      if (entrega.estado === 'CALIFICADA' && previousGrade !== null && previousGrade >= notaAprobacion) {
        throw new BadRequestException(
          `Tu entrega ya fue aprobada con ${previousGrade.toFixed(1)}/5.0. No es necesario re-enviar.`,
        );
      }
      const isResubmission =
        entrega.estado === 'CALIFICADA' && previousGrade !== null && previousGrade < notaAprobacion;

      entrega = await this.prisma.lms_entregas.update({
        where: { guid: entrega.guid },
        data: {
          url_archivo_adjunto: serverFilename,
          respuesta_texto: data.nombre_archivo,
          estado: isResubmission ? 'EN_REVISION' : 'ENTREGADA',
          fecha_entrega: new Date(),
        },
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
          const estudiante = await this.prisma.usuarios.findUnique({
            where: { guid: data.usuario_guid },
            select: { nombre: true, apellido: true },
          });
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
          fecha_entrega: new Date(),
        },
      });
    }

    // Notify teachers/admins about the new submission (not students)
    this.lmsGateway.broadcastToRole(
      'submission:new',
      {
        tarea_guid,
        usuario_guid: data.usuario_guid,
        estado: 'ENTREGADA',
      },
      'PROFESOR',
    );
    this.lmsGateway.broadcastToRole(
      'submission:new',
      {
        tarea_guid,
        usuario_guid: data.usuario_guid,
        estado: 'ENTREGADA',
      },
      'ADMINISTRADOR',
    );
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
        archivo_purgado: true,
      },
    });
  }

  async getTodasEntregasParaTarea(tarea_guid: string, usuario_guid: string, role: string) {
    // F1.5/F1.6: Verify the task belongs to a course owned by this professor
    if (role === 'PROFESOR') {
      const recurso = await this.prisma.lms_recursos.findUnique({
        where: { guid: tarea_guid },
        select: {
          leccion: { select: { modulo: { select: { curso: { select: { profesor_guid: true } } } } } },
        },
      });
      if (!recurso) throw new BadRequestException('Tarea no encontrada.');
      const courseProfesor = recurso.leccion?.modulo?.curso?.profesor_guid;
      if (courseProfesor !== usuario_guid) {
        throw new BadRequestException('No tienes permisos para ver entregas de esta tarea.');
      }
    }

    return this.prisma.lms_entregas.findMany({
      where: { tarea_guid },
      select: {
        guid: true,
        estado: true,
        fecha_entrega: true,
        respuesta_texto: true,
        url_archivo_adjunto: true,
        archivo_purgado: true,
        usuario_guid: true,
      },
      orderBy: { fecha_entrega: 'desc' },
    });
  }

  /**
   * Get all deliveries for a professor's courses, enriched with student info and task metadata.
   * Returns up to 500 most recent deliveries ordered by date.
   */
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
                  select: { guid: true, titulo: true, archivo_max_size_mb: true },
                },
              },
            },
          },
        },
      },
    });

    const tareaGuids: string[] = [];
    const tareaInfo: Record<
      string,
      { titulo: string; curso_titulo: string; curso_guid: string; modulo_titulo: string; modulo_guid: string }
    > = {};

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
              modulo_guid: mod.guid,
            };
          }
        }
      }
    }

    if (tareaGuids.length === 0) return [];

    const entregas = await this.prisma.lms_entregas.findMany({
      where: { tarea_guid: { in: tareaGuids } },
      orderBy: { fecha_entrega: 'desc' },
      take: 500,
    });

    const studentGuids = [...new Set(entregas.map((e) => e.usuario_guid))];
    const students = await this.prisma.usuarios.findMany({
      where: { guid: { in: studentGuids } },
      select: { guid: true, nombre: true, apellido: true, email: true },
    });
    const studentMap = Object.fromEntries(students.map((s) => [s.guid, s]));

    return entregas.map((e) => ({
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
      contenido_texto: e.contenido_texto,
      calificacion: e.calificacion ? Number(e.calificacion) : null,
      comentario_calificacion: e.comentario_calificacion,
    }));
  }

  /**
   * Grade a student delivery.
   * - Updates entrega status to CALIFICADA with numeric grade.
   * - If passing grade: creates lms_progreso_recurso record (marks resource complete).
   * - Broadcasts submission:graded to student via WebSocket.
   * - Fire-and-forget: sends notification + grade email to student.
   * - If passing: triggers async certificate check for course completion.
   */
  async calificarEntrega(
    guid: string,
    data: { calificacion: number; comentario?: string },
    profesor_guid: string,
    role: string,
  ) {
    // F3.6: Verify professor owns the course (admins skip this check)
    if (role === 'PROFESOR') {
      const submission = await this.prisma.lms_entregas.findUnique({
        where: { guid },
        select: {
          tarea: {
            select: {
              leccion: { select: { modulo: { select: { curso: { select: { profesor_guid: true } } } } } },
            },
          },
        },
      });
      const courseProfesorGuid = submission?.tarea?.leccion?.modulo?.curso?.profesor_guid;
      if (courseProfesorGuid && courseProfesorGuid !== profesor_guid) {
        throw new BadRequestException('No tienes permisos para calificar entregas de este curso.');
      }
    }

    const entrega = await this.prisma.lms_entregas.update({
      where: { guid },
      data: {
        estado: 'CALIFICADA' as lms_estado_entrega,
        calificacion: data.calificacion,
        comentario_calificacion: data.comentario || null,
        // Keep contenido_texto for backward compatibility during migration
        contenido_texto: `NOTA: ${data.calificacion}${data.comentario ? ` | ${data.comentario}` : ''}`,
      },
    });

    // BUG-01 FIX: Look up the course's actual nota_aprobacion instead of hardcoding 3.0
    let notaAprobacion = 3.0; // safe default
    if (entrega.tarea_guid) {
      const recurso = await this.prisma.lms_recursos.findUnique({
        where: { guid: entrega.tarea_guid },
        select: { leccion: { select: { modulo: { select: { curso: { select: { nota_aprobacion: true } } } } } } },
      });
      if (recurso?.leccion?.modulo?.curso?.nota_aprobacion != null) {
        notaAprobacion = Number(recurso.leccion.modulo.curso.nota_aprobacion);
      }
    }

    if (data.calificacion >= notaAprobacion && entrega.tarea_guid) {
      const existing = await this.prisma.lms_progreso_recurso.findUnique({
        where: {
          usuario_guid_recurso_guid: {
            usuario_guid: entrega.usuario_guid,
            recurso_guid: entrega.tarea_guid,
          },
        },
      });
      if (!existing) {
        await this.prisma.lms_progreso_recurso.create({
          data: {
            usuario_guid: entrega.usuario_guid,
            recurso_guid: entrega.tarea_guid,
            completado: true,
          },
        });
      }
    }

    // Broadcast immediately for real-time UI — only to the affected student
    this.lmsGateway.broadcast(
      'submission:graded',
      {
        guid,
        tarea_guid: entrega.tarea_guid,
        calificacion: data.calificacion,
        usuario_guid: entrega.usuario_guid,
      },
      [entrega.usuario_guid],
    );
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'submission_graded' });

    // Fire-and-forget: notifications + email (don't block the response)
    (async () => {
      try {
        const [tareaInfo, estudianteInfo] = await Promise.all([
          entrega.tarea_guid
            ? this.prisma.lms_recursos.findUnique({ where: { guid: entrega.tarea_guid }, select: { titulo: true } })
            : null,
          this.prisma.usuarios.findUnique({
            where: { guid: entrega.usuario_guid },
            select: { email: true, nombre: true },
          }),
        ]);
        const tareaTitulo = tareaInfo?.titulo || 'Tarea';

        const notifPromise =
          data.calificacion < notaAprobacion
            ? this.notificacionesService.crearNotificacion({
                usuario_guid: entrega.usuario_guid,
                tipo: 'ENTREGA_RECHAZADA',
                titulo: 'Calificación insuficiente',
                mensaje: `Tu entrega en "${tareaTitulo}" obtuvo ${data.calificacion.toFixed(1)}/5.0. Debes subir un nuevo documento para mejorar tu nota.${data.comentario ? ` Comentario: ${data.comentario}` : ''}`,
                ref_tipo: 'entrega',
                ref_guid: guid,
              })
            : this.notificacionesService.crearNotificacion({
                usuario_guid: entrega.usuario_guid,
                tipo: 'TAREA_CALIFICADA',
                titulo: '¡Tarea calificada!',
                mensaje: `Tu entrega en "${tareaTitulo}" obtuvo ${data.calificacion.toFixed(1)}/5.0. ¡Buen trabajo!${data.comentario ? ` Comentario: ${data.comentario}` : ''}`,
                ref_tipo: 'entrega',
                ref_guid: guid,
              });

        const emailPromise = estudianteInfo
          ? data.calificacion < notaAprobacion
            ? this.mailService.sendSubmissionRejected(
                estudianteInfo.email,
                estudianteInfo.nombre,
                tareaTitulo,
                data.calificacion,
                data.comentario,
              )
            : this.mailService.sendGradeNotification(
                estudianteInfo.email,
                estudianteInfo.nombre,
                tareaTitulo,
                data.calificacion,
                notaAprobacion,
              )
          : Promise.resolve();

        await Promise.all([notifPromise, emailPromise]);
      } catch (err) {
        this.logger.error('Grade notification error:', err);
      }
    })();

    // ── Check if this grading completes the course for certificate generation ──
    if (data.calificacion >= notaAprobacion && entrega.tarea_guid) {
      this.certificadosService.checkCertificateAfterGrading(entrega.usuario_guid, entrega.tarea_guid).catch((err) => {
        this.logger.error('Post-grading certificate check error:', err?.message || err);
      });
    }

    return entrega;
  }
}
