import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { lms_tipo_matricula } from '@prisma/client';
import { LmsGateway } from '../ws/lms.gateway';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';
import * as fs from 'fs';

@Injectable()
export class MatriculasService {
  private readonly logger = new Logger(MatriculasService.name);
  constructor(
    private prisma: PrismaService,
    private lmsGateway: LmsGateway,
    private mailService: MailService,
    private storageService: StorageService,
  ) {}

  async matricularEstudiante(curso_guid: string, usuario_guid: string) {
    const existing = await this.prisma.lms_matriculas.findUnique({
      where: { usuario_guid_curso_guid: { usuario_guid, curso_guid } },
    });
    if (existing) return existing;

    // ── Clean slate: wipe any previous course data if the student is being re-enrolled ──
    // This handles the re-certification scenario where a student completed the course,
    // was un-enrolled, and is now being enrolled again to redo it from scratch.
    await this.wipePreviousCourseData(usuario_guid, curso_guid);

    const result = await this.prisma.lms_matriculas.create({
      data: { usuario_guid, curso_guid, tipo: 'MANUAL' as lms_tipo_matricula },
    });

    this.lmsGateway.broadcast('enrollment:changed', { action: 'enrolled', curso_guid, usuario_guid }, [usuario_guid]);
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'enrollment_changed' }, [usuario_guid]);
    this.lmsGateway.broadcastToRole('dashboard:refresh', { reason: 'enrollment_changed' }, 'ADMINISTRADOR');

    // Fire-and-forget: Send enrollment email notification
    (async () => {
      try {
        const [student, course] = await Promise.all([
          this.prisma.usuarios.findUnique({ where: { guid: usuario_guid }, select: { email: true, nombre: true } }),
          this.prisma.lms_cursos.findUnique({ where: { guid: curso_guid }, select: { titulo: true } }),
        ]);
        if (student && course) {
          this.mailService
            .sendEnrollmentNotification(student.email, student.nombre, course.titulo, curso_guid)
            .catch(() => {});
        }
      } catch (err) {
        this.logger.error('Enrollment email error:', err);
      }
    })();

    return result;
  }

  /**
   * Wipe all previous course data for a student being re-enrolled.
   * Deletes: old certificate + PDF, progress, submissions + files, session data.
   * This ensures a completely fresh start for re-certification.
   */
  private async wipePreviousCourseData(usuario_guid: string, curso_guid: string): Promise<void> {
    // Check if there's an old certificate to delete
    const oldCert = await this.prisma.lms_certificados.findUnique({
      where: { usuario_guid_curso_guid: { usuario_guid, curso_guid } },
    });

    if (!oldCert) {
      // No previous data likely exists — check and clean up residuals anyway
      const hasProgress = await this.prisma.lms_progreso_recurso.count({
        where: { usuario_guid, recurso: { leccion: { modulo: { curso_guid } } } },
      });
      if (hasProgress === 0) return; // Truly fresh — nothing to wipe
    }

    this.logger.log(`🔄 Re-enrollment detected: wiping previous data for user ${usuario_guid} in course ${curso_guid}`);

    // ── Collect file keys BEFORE transaction (reads only) ──
    const filesToDelete: string[] = [];

    if (oldCert) {
      filesToDelete.push(`certificados/${oldCert.archivo_pdf}`);
    }

    // Get all resource GUIDs in the course for targeted cleanup
    const curso = await this.prisma.lms_cursos.findUnique({
      where: { guid: curso_guid },
      select: {
        modulos: {
          select: {
            lecciones: {
              select: {
                recursos: { select: { guid: true, tipo: true } },
              },
            },
          },
        },
      },
    });

    const allResources = curso?.modulos.flatMap((m) => m.lecciones.flatMap((l) => l.recursos)) || [];
    const allResourceGuids = allResources.map((r) => r.guid);
    const taskGuids = allResources.filter((r) => r.tipo === 'TAREA').map((r) => r.guid);

    // Collect submission file keys before deleting records
    if (taskGuids.length > 0) {
      const entregas = await this.prisma.lms_entregas.findMany({
        where: { usuario_guid, tarea_guid: { in: taskGuids }, url_archivo_adjunto: { not: null } },
        select: { url_archivo_adjunto: true },
      });
      for (const e of entregas) {
        if (e.url_archivo_adjunto) filesToDelete.push(e.url_archivo_adjunto);
      }
    }

    // ── Atomic DB cleanup via $transaction ──
    await this.prisma.$transaction(async (tx) => {
      // 1. Delete certificate record
      if (oldCert) {
        await tx.lms_certificados.delete({
          where: { usuario_guid_curso_guid: { usuario_guid, curso_guid } },
        });
        this.logger.log(`  Deleted old certificate record`);
      }

      // 2. Delete submission records
      if (taskGuids.length > 0) {
        const deletedEntregas = await tx.lms_entregas.deleteMany({
          where: { usuario_guid, tarea_guid: { in: taskGuids } },
        });
        this.logger.log(`  Deleted ${deletedEntregas.count} old submission(s)`);
      }

      // 3. Delete progress records
      if (allResourceGuids.length > 0) {
        const deletedProgress = await tx.lms_progreso_recurso.deleteMany({
          where: { usuario_guid, recurso_guid: { in: allResourceGuids } },
        });
        this.logger.log(`  Deleted ${deletedProgress.count} progress record(s)`);
      }

      // 4. Delete session/heartbeat data
      const deletedSessions = await tx.lms_sesion_activa.deleteMany({
        where: { usuario_guid, curso_guid },
      });
      this.logger.log(`  Deleted ${deletedSessions.count} session record(s)`);

      // 5. Delete old notifications related to this course
      const deletedNotifs = await tx.lms_notificaciones.deleteMany({
        where: { usuario_guid, ref_tipo: 'certificado' },
      });
      if (deletedNotifs.count > 0) {
        this.logger.log(`  Deleted ${deletedNotifs.count} old certificate notification(s)`);
      }
    });

    // ── File cleanup AFTER successful transaction (best-effort) ──
    for (const key of filesToDelete) {
      try {
        // Try local filesystem
        const localPath = this.storageService.getUploadPath(key);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
          this.logger.log(`  Deleted local file: ${key}`);
        }
      } catch {
        // Local file might not exist
      }
      try {
        await this.storageService.deleteFile(key);
      } catch {
        // R2 not configured or file doesn't exist — scheduler cleanup will handle orphans
      }
    }

    this.logger.log(`✅ Previous course data wiped — student will start fresh`);
  }

  async desmatricularEstudiante(curso_guid: string, usuario_guid: string) {
    const result = await this.prisma.lms_matriculas.delete({
      where: { usuario_guid_curso_guid: { usuario_guid, curso_guid } },
    });

    this.lmsGateway.broadcast('enrollment:changed', { action: 'unenrolled', curso_guid, usuario_guid }, [usuario_guid]);
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'enrollment_changed' }, [usuario_guid]);
    this.lmsGateway.broadcastToRole('dashboard:refresh', { reason: 'enrollment_changed' }, 'ADMINISTRADOR');

    return result;
  }

  async getMatriculasCurso(curso_guid: string) {
    return this.prisma.lms_matriculas.findMany({
      where: { curso_guid },
      include: {
        usuario: { select: { guid: true, nombre: true, apellido: true, email: true } },
      },
      take: 1000,
    });
  }

  async getEstudiantesDisponibles() {
    return this.prisma.usuarios.findMany({
      where: { rol: 'ESTUDIANTE' },
      select: { guid: true, nombre: true, apellido: true, email: true },
    });
  }

  async seedMatriculas() {
    // Guard against accidental execution in production
    if (process.env.NODE_ENV === 'production') {
      throw new Error('seedMatriculas no está disponible en producción.');
    }

    const estudiantes = await this.prisma.usuarios.findMany({ where: { rol: 'ESTUDIANTE' } });
    const cursos = await this.prisma.lms_cursos.findMany({ where: { estado: 'PUBLICADO' } });

    let count = 0;
    for (const est of estudiantes) {
      for (const curso of cursos) {
        const existing = await this.prisma.lms_matriculas.findUnique({
          where: { usuario_guid_curso_guid: { usuario_guid: est.guid, curso_guid: curso.guid } },
        });
        if (!existing) {
          await this.prisma.lms_matriculas.create({
            data: { usuario_guid: est.guid, curso_guid: curso.guid, tipo: 'MANUAL' as lms_tipo_matricula },
          });
          count++;
        }
      }
    }
    return { matriculas_creadas: count };
  }
}
