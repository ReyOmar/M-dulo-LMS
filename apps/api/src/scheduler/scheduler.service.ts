import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { MailService } from '../mail/mail.service';
import { LmsGateway } from '../ws/lms.gateway';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  // Track courses that were in BORRADOR so we can detect when they go back to PUBLICADO
  private previousDraftCourses = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private mailService: MailService,
    private lmsGateway: LmsGateway,
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
   * Check for inactive students every day at 8:00 AM
   * Students who haven't accessed in 3+ days get a reminder notification and email.
   */
  @Cron('0 8 * * *') // Every day at 8:00 AM
  async checkInactiveStudents() {
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
        // Create in-app notification
        await this.notificacionesService.crearNotificacion({
          usuario_guid: student.guid,
          tipo: 'RECORDATORIO_INACTIVIDAD',
          titulo: 'Te echamos de menos',
          mensaje: `Llevas ${diasInactivo} días sin acceder a la plataforma. ¡Tu progreso es importante!`,
          url_accion: '/dashboard',
        });

        // Send email
        await this.mailService.sendInactivityReminder(
          student.email,
          student.nombre,
          diasInactivo,
        );

        this.logger.log(`Inactivity reminder sent to ${student.email} (${diasInactivo} days)`);
      }
    }
  }

  /**
   * Check every 5 minutes if any course went from BORRADOR to PUBLICADO
   * This handles "course reactivated" notifications.
   */
  @Cron('*/5 * * * *') // Every 5 minutes
  async checkCourseReactivation() {
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

    // Update snapshot
    this.previousDraftCourses = currentDraftSet;
  }

  /**
   * Auto-unlock resources when assignments are pending grading for >48 hours.
   * Runs every hour. Creates progress records so students can advance.
   */
  @Cron('0 * * * *') // Every hour at minute 0
  async autoUnlockPendingSubmissions() {
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
  }
}
