import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { MailService } from '../mail/mail.service';
import { LmsGateway } from '../ws/lms.gateway';

@Injectable()
export class SchedulerService implements OnModuleInit {
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
    console.log('🕐 Scheduler initialized — monitoring', drafts.length, 'draft courses');
  }

  /**
   * Check for inactive students every day at 8:00 AM
   * Students who haven't accessed in 3+ days get a reminder notification and email.
   */
  @Cron('0 8 * * *') // Every day at 8:00 AM
  async checkInactiveStudents() {
    console.log('🕐 Running inactivity check...');
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

        console.log(`📧 Inactivity reminder sent to ${student.email} (${diasInactivo} days)`);
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
          console.log(`📢 Course reactivated: ${curso.titulo}`);

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
}
