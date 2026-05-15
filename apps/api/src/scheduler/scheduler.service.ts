import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { MailService } from '../mail/mail.service';
import { LmsGateway } from '../ws/lms.gateway';
import { StorageService } from '../storage/storage.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  // Track courses that were in BORRADOR so we can detect when they go back to PUBLICADO
  private previousDraftCourses = new Set<string>();
  // Guard against overlapping cron executions (single-instance idempotency)
  private runningJobs = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private mailService: MailService,
    private lmsGateway: LmsGateway,
    private storageService: StorageService,
  ) {}

  async onModuleInit() {
    // Snapshot initial draft courses
    const drafts = await this.prisma.lms_cursos.findMany({
      where: { estado: 'BORRADOR' },
      select: { guid: true },
    });
    drafts.forEach(d => this.previousDraftCourses.add(d.guid));
    this.logger.log(`Scheduler initialized — monitoring ${drafts.length} draft courses`);
  }

  /**
   * Guard to prevent overlapping cron executions.
   * If a job with the same name is already running, skip the execution.
   */
  private async withJobLock(jobName: string, fn: () => Promise<void>): Promise<void> {
    if (this.runningJobs.has(jobName)) {
      this.logger.warn(`Skipping ${jobName} — previous execution still running`);
      return;
    }
    this.runningJobs.add(jobName);
    try {
      await fn();
    } catch (err) {
      this.logger.error(`${jobName} failed:`, err);
    } finally {
      this.runningJobs.delete(jobName);
    }
  }

  /**
   * Check for inactive students every day at 8:00 AM
   * Students who haven't accessed in 3+ days get a reminder notification and email.
   */
  @Cron('0 8 * * *') // Every day at 8:00 AM
  async checkInactiveStudents() {
    return this.withJobLock('checkInactiveStudents', async () => {
    this.logger.log('Running inactivity check...');
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const inactiveStudents = await this.prisma.usuarios.findMany({
      where: {
        rol: 'ESTUDIANTE',
        activo: true,
        OR: [
          { ultimo_acceso: { lt: threeDaysAgo } },
          { ultimo_acceso: null },
        ],
      },
      select: { guid: true, email: true, nombre: true, apellido: true, ultimo_acceso: true },
    });

    for (const student of inactiveStudents) {
      const diasInactivo = student.ultimo_acceso
        ? Math.floor((Date.now() - student.ultimo_acceso.getTime()) / (24 * 60 * 60 * 1000))
        : 999;

      // Only send reminder once per period (check if we already notified recently)
      const recentReminder = await this.prisma.lms_notificaciones.findFirst({
        where: {
          usuario_guid: student.guid,
          tipo: 'RECORDATORIO_INACTIVIDAD',
          created_at: { gt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        },
      });

      if (!recentReminder) {
        // Fetch student's course progress for the email
        const matriculas = await this.prisma.lms_matriculas.findMany({
          where: { usuario_guid: student.guid },
          select: {
            curso: {
              select: {
                guid: true,
                titulo: true,
                modulos: {
                  select: {
                    lecciones: {
                      select: {
                        recursos: { select: { guid: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        let progreso: { curso: string; porcentaje: number }[] = [];
        if (matriculas.length > 0) {
          const allResourceGuids = matriculas.flatMap((m) =>
            m.curso.modulos.flatMap((mod) =>
              mod.lecciones.flatMap((l) => l.recursos.map((r) => r.guid)),
            ),
          );
          const completedResources = await this.prisma.lms_progreso_recurso.findMany({
            where: { usuario_guid: student.guid, recurso_guid: { in: allResourceGuids } },
            select: { recurso_guid: true },
          });
          const completedSet = new Set(completedResources.map((r) => r.recurso_guid));

          progreso = matriculas.map((m) => {
            const totalRecursos = m.curso.modulos.reduce(
              (sum, mod) => sum + mod.lecciones.reduce((s, l) => s + l.recursos.length, 0),
              0,
            );
            const completados = m.curso.modulos.reduce(
              (sum, mod) =>
                sum +
                mod.lecciones.reduce(
                  (s, l) => s + l.recursos.filter((r) => completedSet.has(r.guid)).length,
                  0,
                ),
              0,
            );
            return {
              curso: m.curso.titulo,
              porcentaje: totalRecursos > 0 ? Math.round((completados / totalRecursos) * 100) : 0,
            };
          });
        }

        // Create in-app notification
        await this.notificacionesService.crearNotificacion({
          usuario_guid: student.guid,
          tipo: 'RECORDATORIO_INACTIVIDAD',
          titulo: 'Te echamos de menos',
          mensaje: `Llevas ${diasInactivo} días sin acceder a la plataforma. ¡Tu progreso es importante!`,
          url_accion: '/dashboard',
        });

        // Send email with progress
        await this.mailService.sendInactivityReminder(
          student.email,
          student.nombre,
          diasInactivo,
          progreso,
        );

        this.logger.log(`Inactivity reminder sent to ${student.email} (${diasInactivo} days)`);
      }
    }
    }); // end withJobLock
  }

  /**
   * Check every 5 minutes if any course went from BORRADOR to PUBLICADO
   * This handles "course reactivated" notifications.
   */
  @Cron('*/5 * * * *') // Every 5 minutes
  async checkCourseReactivation() {
    return this.withJobLock('checkCourseReactivation', async () => {
    const currentDrafts = await this.prisma.lms_cursos.findMany({
      where: { estado: 'BORRADOR' },
      select: { guid: true },
    });
    const currentDraftSet = new Set(currentDrafts.map(d => d.guid));

    // Courses that were BORRADOR before but no longer are = reactivated
    for (const prevDraftGuid of this.previousDraftCourses) {
      if (!currentDraftSet.has(prevDraftGuid)) {
        // This course was reactivated
        const curso = await this.prisma.lms_cursos.findUnique({
          where: { guid: prevDraftGuid },
          select: { guid: true, titulo: true, estado: true },
        });

        if (curso && curso.estado === 'PUBLICADO') {
          this.logger.log(`Course reactivated: ${curso.titulo}`);

          // Get enrolled students
          const matriculas = await this.prisma.lms_matriculas.findMany({
            where: { curso_guid: prevDraftGuid },
            include: { usuario: { select: { guid: true, email: true, nombre: true } } },
          });

          for (const m of matriculas) {
            // In-app notification
            await this.notificacionesService.crearNotificacion({
              usuario_guid: m.usuario_guid,
              tipo: 'CURSO_REACTIVADO',
              titulo: '¡Curso disponible nuevamente!',
              mensaje: `El curso "${curso.titulo}" que estaba en mantenimiento ya está activo. ¡Puedes continuar!`,
              ref_tipo: 'curso',
              ref_guid: curso.guid,
            });

            // Email notification
            await this.mailService.sendCourseReactivated(
              m.usuario.email,
              m.usuario.nombre,
              curso.titulo,
            );
          }

          // Broadcast to all enrolled students
          const enrolledGuids = matriculas.map(m => m.usuario_guid);
          this.lmsGateway.broadcast('course:updated', {
            guid: curso.guid,
            titulo: curso.titulo,
            estado: 'PUBLICADO',
            reactivated: true,
          }, enrolledGuids);
        }
      }
    }

    this.previousDraftCourses = currentDraftSet;
    }); // end withJobLock
  }

  /**
   * Auto-unlock resources when assignments are pending grading for >48 hours.
   * Runs every hour. Creates progress records so students can advance.
   */
  @Cron('0 * * * *') // Every hour at minute 0
  async autoUnlockPendingSubmissions() {
    return this.withJobLock('autoUnlockPendingSubmissions', async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Find all submissions that are ENTREGADA or EN_REVISION and older than 48 hours
    const pendingSubmissions = await this.prisma.lms_entregas.findMany({
      where: {
        estado: { in: ['ENTREGADA', 'EN_REVISION'] },
        fecha_entrega: { lt: twoDaysAgo },
        tarea_guid: { not: null },
      },
      select: {
        guid: true,
        usuario_guid: true,
        tarea_guid: true,
        fecha_entrega: true,
        calificacion: true,
      },
    });

    if (pendingSubmissions.length === 0) return;

    let unlocked = 0;

    for (const submission of pendingSubmissions) {
      if (!submission.tarea_guid) continue;

      // Check if progress already exists (already unlocked)
      const existing = await this.prisma.lms_progreso_recurso.findUnique({
        where: {
          usuario_guid_recurso_guid: {
            usuario_guid: submission.usuario_guid,
            recurso_guid: submission.tarea_guid,
          },
        },
      });

      if (existing) continue; // Already unlocked

      // F5.8: If submission already has a calificacion, verify it meets nota_aprobacion
      // This prevents auto-unlock for submissions that were graded as failing
      // but whose estado wasn't transitioned to CALIFICADA correctly
      if (submission.calificacion != null) {
        const recursoConCurso = await this.prisma.lms_recursos.findUnique({
          where: { guid: submission.tarea_guid },
          select: {
            leccion: {
              select: {
                modulo: {
                  select: {
                    curso: { select: { nota_aprobacion: true } }
                  }
                }
              }
            }
          }
        });
        const notaAprobacion = recursoConCurso?.leccion?.modulo?.curso?.nota_aprobacion
          ? Number(recursoConCurso.leccion.modulo.curso.nota_aprobacion)
          : 3.0;

        if (Number(submission.calificacion) < notaAprobacion) {
          this.logger.warn(`Skipping auto-unlock for submission ${submission.guid}: grade ${submission.calificacion} < ${notaAprobacion}`);
          continue; // Don't unlock — student needs to resubmit
        }
      }

      // Create progress record to unlock the next resource
      await this.prisma.lms_progreso_recurso.create({
        data: {
          usuario_guid: submission.usuario_guid,
          recurso_guid: submission.tarea_guid,
          completado: true,
        },
      });

      unlocked++;

      // Get task info for notification
      const recursoInfo = await this.prisma.lms_recursos.findUnique({
        where: { guid: submission.tarea_guid },
        select: { titulo: true },
      });

      // Notify student
      await this.notificacionesService.crearNotificacion({
        usuario_guid: submission.usuario_guid,
        tipo: 'MODULO_COMPLETADO',
        titulo: '🔓 Recurso desbloqueado automáticamente',
        mensaje: `Tu tarea "${recursoInfo?.titulo || 'Tarea'}" lleva más de 48 horas esperando calificación. Hemos desbloqueado el siguiente recurso para que puedas seguir avanzando. La tarea sigue pendiente de revisión por el examinador.`,
        url_accion: '/dashboard/student/cursos',
      }).catch((err) => this.logger.error('Auto-unlock notification error:', err));
    }

    if (unlocked > 0) {
      this.logger.log(`Auto-unlocked ${unlocked} resources for pending submissions >48h`);
      this.lmsGateway.broadcast('dashboard:refresh', { reason: 'auto_unlock' });
    }
    }); // end withJobLock
  }

  /**
   * F7.7: Clean up orphan files in uploads/ directory.
   * Runs daily at 3:00 AM. Finds files not referenced in the DB and deletes them.
   * Only deletes files older than 24h to avoid race conditions with in-progress uploads.
   */
  @Cron('0 3 * * *') // Daily at 3:00 AM
  async cleanupOrphanFiles() {
    return this.withJobLock('cleanupOrphanFiles', async () => {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) return;

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Get all filenames referenced in DB
    const [recursos, entregas, certificados, usuarios, configuracion, cursos] = await Promise.all([
      this.prisma.lms_recursos.findMany({
        where: { OR: [{ archivo_adjunto: { not: null } }, { url_archivo: { not: null } }] },
        select: { archivo_adjunto: true, url_archivo: true },
      }),
      this.prisma.lms_entregas.findMany({
        where: { url_archivo_adjunto: { not: null } },
        select: { url_archivo_adjunto: true },
      }),
      this.prisma.lms_certificados.findMany({
        select: { archivo_pdf: true },
      }),
      this.prisma.usuarios.findMany({
        where: { OR: [{ firma_url: { not: null } }, { foto_url: { not: null } }] },
        select: { firma_url: true, foto_url: true },
      }),
      this.prisma.lms_configuracion.findFirst({
        select: { logo_url: true, favicon_url: true, login_fondo_url: true },
      }),
      this.prisma.lms_cursos.findMany({
        where: { imagen_portada: { not: null } },
        select: { imagen_portada: true },
      }),
    ]);

    const referencedFiles = new Set<string>();
    recursos.forEach(r => {
      if (r.archivo_adjunto) referencedFiles.add(r.archivo_adjunto);
      if ((r as any).url_archivo) referencedFiles.add((r as any).url_archivo);
    });
    entregas.forEach(e => e.url_archivo_adjunto && referencedFiles.add(e.url_archivo_adjunto));
    certificados.forEach(c => c.archivo_pdf && referencedFiles.add(c.archivo_pdf));
    usuarios.forEach(u => {
      if (u.firma_url) referencedFiles.add(u.firma_url);
      if ((u as any).foto_url) referencedFiles.add((u as any).foto_url);
    });
    cursos.forEach(c => c.imagen_portada && referencedFiles.add(c.imagen_portada));
    if (configuracion?.logo_url) referencedFiles.add(configuracion.logo_url);
    if ((configuracion as any)?.favicon_url) referencedFiles.add((configuracion as any).favicon_url);
    if ((configuracion as any)?.login_fondo_url) referencedFiles.add((configuracion as any).login_fondo_url);

    // SEC: Scan local files recursively (including subdirectories)
    const getAllFiles = (dir: string, prefix = ''): { relativePath: string; fullPath: string }[] => {
      const results: { relativePath: string; fullPath: string }[] = [];
      if (!fs.existsSync(dir)) return results;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          results.push(...getAllFiles(fullPath, relPath));
        } else if (entry.isFile()) {
          results.push({ relativePath: relPath, fullPath });
        }
      }
      return results;
    };

    const localFiles = getAllFiles(uploadsDir);

    let deleted = 0;
    for (const file of localFiles) {
      // Check both the relative path and just the filename for referenced files
      if (referencedFiles.has(file.relativePath) || referencedFiles.has(path.basename(file.relativePath))) continue;

      const stat = fs.statSync(file.fullPath);

      // Only delete files older than 24h (safety buffer)
      if (stat.mtimeMs > oneDayAgo) continue;

      try {
        fs.unlinkSync(file.fullPath);
        deleted++;
        this.logger.log(`Deleted orphan file: ${file.relativePath}`);
      } catch (err) {
        this.logger.warn(`Failed to delete orphan file: ${file.relativePath}`, err);
      }
    }

    if (deleted > 0) {
      this.logger.log(`Orphan cleanup: deleted ${deleted} unreferenced files`);
    }
    }); // end withJobLock
  }

  /**
   * F7.5.5: Weekly retrospective purge — clean up submission files
   * for students who already have a certificate but files weren't purged
   * (e.g. submissions from before this feature was implemented).
   * Runs every Sunday at 4:00 AM.
   */
  @Cron('0 4 * * 0')
  async purgeRetroactiveEntregaFiles() {
    return this.withJobLock('purgeRetroactiveEntregaFiles', async () => {
    this.logger.log('⏰ Running weekly retrospective entrega file purge...');

    try {
      // Find entregas that have files + are CALIFICADA + the user has a certificate for that course
      const entregas = await this.prisma.$queryRaw<Array<{
        guid: string;
        url_archivo_adjunto: string;
      }>>`
        SELECT e.guid, e.url_archivo_adjunto
        FROM lms_entregas e
        INNER JOIN lms_recursos r ON e.tarea_guid = r.guid
        INNER JOIN lms_lecciones l ON r.leccion_guid = l.guid
        INNER JOIN lms_modulos m ON l.modulo_guid = m.guid
        INNER JOIN lms_certificados c ON c.usuario_guid = e.usuario_guid AND c.curso_guid = m.curso_guid
        WHERE e.url_archivo_adjunto IS NOT NULL
          AND e.archivo_purgado = false
          AND e.estado = 'CALIFICADA'
      `;

      if (entregas.length === 0) {
        this.logger.log('No retrospective entregas to purge.');
        return;
      }

      let purged = 0;
      for (const entrega of entregas) {
        try {
          await this.storageService.deleteFile(entrega.url_archivo_adjunto);
          await this.prisma.lms_entregas.update({
            where: { guid: entrega.guid },
            data: { url_archivo_adjunto: null, archivo_purgado: true },
          });
          purged++;
        } catch (err) {
          this.logger.warn(`Failed to purge retroactive entrega ${entrega.guid}:`, err);
        }
      }

      this.logger.log(`📦 Retrospective purge: cleaned ${purged}/${entregas.length} submission files`);
    } catch (err) {
      this.logger.error('Retrospective purge failed:', err);
    }
    }); // end withJobLock
  }
}
