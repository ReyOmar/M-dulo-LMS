import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificacionesService } from '../../notificaciones/notificaciones.service';
import { MailService } from '../../mail/mail.service';
import { CertificadosService } from '../../certificados/certificados.service';
import { LmsGateway } from '../../ws/lms.gateway';

/**
 * LmsEventListener — Centralized event handler for cross-cutting concerns.
 * Decouples domain services from notification, email, and certificate logic
 * using @nestjs/event-emitter events.
 *
 * Events handled:
 * - quiz.passed: Notify student, check for certificate
 * - quiz.failed: Reset module progress, notify student + professor, send email
 * - submission.graded: Broadcast WS event for UI refresh
 */
@Injectable()
export class LmsEventListener {
  private readonly logger = new Logger(LmsEventListener.name);

  constructor(
    private notificacionesService: NotificacionesService,
    private mailService: MailService,
    private certificadosService: CertificadosService,
    private lmsGateway: LmsGateway,
  ) {}

  @OnEvent('quiz.passed')
  async handleQuizPassed(payload: {
    usuario_guid: string;
    recurso_guid: string;
    nota: number;
    titulo_quiz: string;
  }) {
    const { usuario_guid, recurso_guid, nota, titulo_quiz } = payload;

    // Notify student of success
    await this.notificacionesService.crearNotificacion({
      usuario_guid,
      tipo: 'TAREA_CALIFICADA',
      titulo: '¡Cuestionario aprobado!',
      mensaje: `Obtuviste ${nota.toFixed(1)}/5.0 en "${titulo_quiz}". ¡Buen trabajo!`,
      ref_tipo: 'quiz',
      ref_guid: recurso_guid,
    });

    // Check if this completes the course for certificate generation
    this.certificadosService.checkCertificateAfterGrading(usuario_guid, recurso_guid).catch((err) => {
      this.logger.error('Post-quiz certificate check error:', err?.message || err);
    });
  }

  @OnEvent('quiz.failed')
  async handleQuizFailed(payload: {
    usuario_guid: string;
    recurso_guid: string;
    nota: number;
    titulo_quiz: string;
    modulo_guid: string;
    modulo_titulo: string;
    curso_titulo: string;
    profesor_guid: string;
    estudiante: { nombre: string; apellido: string; email: string } | null;
  }) {
    const { usuario_guid, recurso_guid, nota, titulo_quiz, modulo_guid, modulo_titulo, curso_titulo, profesor_guid, estudiante } = payload;
    const nombreEstudiante = estudiante ? `${estudiante.nombre} ${estudiante.apellido}` : 'Estudiante';

    // Broadcast for UI refresh
    this.lmsGateway.broadcast('submission:graded', {
      recurso_guid, usuario_guid, nota,
      module_reset: true, modulo_guid,
    }, [usuario_guid]);

    // Fire-and-forget: notifications + email
    Promise.all([
      this.notificacionesService.crearNotificacion({
        usuario_guid,
        tipo: 'ENTREGA_RECHAZADA',
        titulo: 'Cuestionario no superado',
        mensaje: `Obtuviste ${nota.toFixed(1)}/5.0 en "${titulo_quiz}". Debes repasar el módulo "${modulo_titulo}" desde el inicio para poder intentarlo de nuevo.`,
        ref_tipo: 'quiz', ref_guid: recurso_guid,
      }),
      this.notificacionesService.crearNotificacion({
        usuario_guid: profesor_guid,
        tipo: 'REVISION_ENTREGA',
        titulo: 'Estudiante suspendió cuestionario',
        mensaje: `${nombreEstudiante} obtuvo ${nota.toFixed(1)}/5.0 en "${titulo_quiz}" del curso "${curso_titulo}". Ha sido devuelto al inicio del módulo "${modulo_titulo}".`,
        ref_tipo: 'quiz', ref_guid: recurso_guid,
      }),
      estudiante
        ? this.mailService.sendQuizFailedModuleReset(estudiante.email, estudiante.nombre, titulo_quiz, modulo_titulo, nota)
        : Promise.resolve(),
    ]).catch(err => this.logger.error('Quiz notification error:', err));
  }
}
