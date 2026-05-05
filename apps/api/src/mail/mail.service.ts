import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress: string;
  private fromName: string;
  private appUrl: string;
  private enabled: boolean = false;

  constructor(private configService: ConfigService) {
    this.fromAddress = this.configService.get<string>('SMTP_FROM') || 'noreply@lms.local';
    this.fromName = this.configService.get<string>('SMTP_FROM_NAME') || 'Campus Virtual';
    this.appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3100';
  }

  async onModuleInit() {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<string>('SMTP_PORT');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (smtpHost && smtpUser && smtpPass) {
      // Production SMTP
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || '587', 10),
        secure: (smtpPort || '587') === '465',
        auth: { user: smtpUser, pass: smtpPass },
      });
      this.enabled = true;
      console.log(`📧 Mail service [PRODUCTION]: ${smtpHost}:${smtpPort}`);
    } else {
      // Development fallback: Ethereal (catches all emails, provides preview URL)
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        this.fromAddress = testAccount.user;
        this.enabled = true;
        console.log(`📧 Mail service [DEV/ETHEREAL]: ${testAccount.user}`);
        console.log(`📧 Preview emails at: https://ethereal.email/login (user: ${testAccount.user}, pass: ${testAccount.pass})`);
      } catch (err) {
        console.log('📧 Mail service DISABLED — Could not create Ethereal account. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env for production.');
      }
    }
  }

  /**
   * Send an email. Returns silently if mail is not configured.
   */
  async sendMail(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      console.log(`📧 [MOCK] Email to ${to}: ${subject}`);
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to,
        subject,
        html,
      });
      console.log(`📧 Email sent to ${to}: ${subject}`);
      // Show preview URL for Ethereal (dev mode)
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`📧 Preview: ${previewUrl}`);
      }
      return true;
    } catch (err) {
      console.error(`📧 Email error to ${to}:`, err);
      return false;
    }
  }

  // ─── TEMPLATE METHODS ────────────────────────────────────

  /**
   * Send password recovery email with a reset link.
   */
  async sendPasswordResetEmail(email: string, token: string, nombre: string) {
    const resetUrl = `${this.appUrl}/restablecer-contrasena?token=${token}`;
    const html = this.wrapTemplate(`
      <h2 style="color:#1e293b;margin:0 0 16px">Recuperar Contraseña</h2>
      <p style="color:#64748b;font-size:15px;line-height:1.6">
        Hola <strong>${nombre}</strong>, recibimos una solicitud para restablecer tu contraseña.
      </p>
      <p style="color:#64748b;font-size:15px;line-height:1.6">
        Haz clic en el siguiente botón para crear una nueva contraseña:
      </p>
      <div style="text-align:center;margin:32px 0">
        <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;font-size:15px">
          Restablecer Contraseña
        </a>
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.6">
        Si no solicitaste este cambio, ignora este correo. El enlace expira en 1 hora.
      </p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;word-break:break-all">
        Link directo: <a href="${resetUrl}" style="color:#4f46e5">${resetUrl}</a>
      </p>
    `);
    return this.sendMail(email, 'Recuperar Contraseña - Campus Virtual', html);
  }

  /**
   * Send grade notification email.
   */
  async sendGradeNotification(email: string, nombre: string, tarea: string, calificacion: number) {
    const emoji = calificacion >= 3.0 ? '🎉' : '⚠️';
    const html = this.wrapTemplate(`
      <h2 style="color:#1e293b;margin:0 0 16px">${emoji} Calificación Recibida</h2>
      <p style="color:#64748b;font-size:15px;line-height:1.6">
        Hola <strong>${nombre}</strong>, tu entrega en <strong>"${tarea}"</strong> ha sido calificada.
      </p>
      <div style="text-align:center;margin:24px 0;padding:20px;background:#f1f5f9;border-radius:12px">
        <span style="font-size:36px;font-weight:800;color:${calificacion >= 3.0 ? '#10b981' : '#ef4444'}">${calificacion.toFixed(1)}</span>
        <span style="font-size:18px;color:#94a3b8">/5.0</span>
      </div>
      ${calificacion < 3.0 ? '<p style="color:#ef4444;font-size:14px;font-weight:600">Debes subir un nuevo documento para mejorar tu nota.</p>' : '<p style="color:#10b981;font-size:14px;font-weight:600">¡Buen trabajo! Sigue así.</p>'}
      <div style="text-align:center;margin:24px 0">
        <a href="${this.appUrl}/dashboard" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;padding:12px 32px;border-radius:12px;text-decoration:none;font-size:14px">
          Ir al Campus
        </a>
      </div>
    `);
    return this.sendMail(email, `Calificación: ${tarea} — ${calificacion.toFixed(1)}/5.0`, html);
  }

  /**
   * Send inactivity reminder email.
   */
  async sendInactivityReminder(email: string, nombre: string, diasInactivo: number) {
    const html = this.wrapTemplate(`
      <h2 style="color:#1e293b;margin:0 0 16px">🔔 Te extrañamos, ${nombre}</h2>
      <p style="color:#64748b;font-size:15px;line-height:1.6">
        Han pasado <strong>${diasInactivo} días</strong> sin que accedas a la plataforma de capacitación.
      </p>
      <p style="color:#64748b;font-size:15px;line-height:1.6">
        Tu progreso es importante. ¡Vuelve y continúa tu aprendizaje!
      </p>
      <div style="text-align:center;margin:32px 0">
        <a href="${this.appUrl}/dashboard" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;font-size:15px">
          Retomar Capacitación
        </a>
      </div>
    `);
    return this.sendMail(email, `Recordatorio: Llevas ${diasInactivo} días sin acceder`, html);
  }

  /**
   * Send course reactivated notification.
   */
  async sendCourseReactivated(email: string, nombre: string, cursoTitulo: string) {
    const html = this.wrapTemplate(`
      <h2 style="color:#1e293b;margin:0 0 16px">✅ Curso Reactivado</h2>
      <p style="color:#64748b;font-size:15px;line-height:1.6">
        Hola <strong>${nombre}</strong>, el curso <strong>"${cursoTitulo}"</strong> que estaba en mantenimiento ya está disponible nuevamente.
      </p>
      <div style="text-align:center;margin:32px 0">
        <a href="${this.appUrl}/dashboard" style="display:inline-block;background:#10b981;color:#fff;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;font-size:15px">
          Continuar Curso
        </a>
      </div>
    `);
    return this.sendMail(email, `Curso Reactivado: ${cursoTitulo}`, html);
  }

  /**
   * Send admin notification about new access request.
   */
  async sendNewAccessRequest(adminEmail: string, adminNombre: string, solicitante: { nombre: string; apellido: string; email: string; rol_pedido: string }) {
    const rolLabel = solicitante.rol_pedido === 'ESTUDIANTE' ? 'Capacitante' : solicitante.rol_pedido === 'PROFESOR' ? 'Examinador' : 'Administrador';
    const html = this.wrapTemplate(`
      <h2 style="color:#1e293b;margin:0 0 16px">📋 Nueva Solicitud de Acceso</h2>
      <p style="color:#64748b;font-size:15px;line-height:1.6">
        Hola <strong>${adminNombre}</strong>, hay una nueva solicitud de acceso pendiente de aprobación.
      </p>
      <div style="background:#f1f5f9;border-radius:12px;padding:20px;margin:20px 0">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#94a3b8;width:100px">Nombre:</td><td style="padding:6px 0;color:#1e293b;font-weight:600">${solicitante.nombre} ${solicitante.apellido}</td></tr>
          <tr><td style="padding:6px 0;color:#94a3b8">Email:</td><td style="padding:6px 0;color:#1e293b;font-weight:600">${solicitante.email}</td></tr>
          <tr><td style="padding:6px 0;color:#94a3b8">Cargo:</td><td style="padding:6px 0;color:#1e293b;font-weight:600">${rolLabel}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${this.appUrl}/dashboard/admin/solicitudes" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;font-size:15px">
          Revisar Solicitud
        </a>
      </div>
    `);
    return this.sendMail(adminEmail, `Nueva Solicitud: ${solicitante.nombre} ${solicitante.apellido}`, html);
  }

  /**
   * Send examiner notification about new submission.
   */
  async sendNewSubmissionNotification(examinerEmail: string, examinerNombre: string, estudiante: string, tarea: string, curso: string) {
    const html = this.wrapTemplate(`
      <h2 style="color:#1e293b;margin:0 0 16px">📝 Nueva Entrega Recibida</h2>
      <p style="color:#64748b;font-size:15px;line-height:1.6">
        Hola <strong>${examinerNombre}</strong>, <strong>${estudiante}</strong> ha enviado una entrega para revisar.
      </p>
      <div style="background:#f1f5f9;border-radius:12px;padding:20px;margin:20px 0">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#94a3b8;width:100px">Tarea:</td><td style="padding:6px 0;color:#1e293b;font-weight:600">${tarea}</td></tr>
          <tr><td style="padding:6px 0;color:#94a3b8">Curso:</td><td style="padding:6px 0;color:#1e293b;font-weight:600">${curso}</td></tr>
          <tr><td style="padding:6px 0;color:#94a3b8">Estudiante:</td><td style="padding:6px 0;color:#1e293b;font-weight:600">${estudiante}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${this.appUrl}/dashboard/examiner/calificaciones" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;font-size:15px">
          Ir a Calificaciones
        </a>
      </div>
    `);
    return this.sendMail(examinerEmail, `Nueva Entrega: ${tarea} — ${estudiante}`, html);
  }

  /**
   * Send quiz failure + module reset notification.
   */
  async sendQuizFailedModuleReset(email: string, nombre: string, quizTitulo: string, moduloTitulo: string, nota: number) {
    const html = this.wrapTemplate(`
      <h2 style="color:#1e293b;margin:0 0 16px">🔄 Módulo Reiniciado</h2>
      <p style="color:#64748b;font-size:15px;line-height:1.6">
        Hola <strong>${nombre}</strong>, no superaste el cuestionario <strong>"${quizTitulo}"</strong>.
      </p>
      <div style="text-align:center;margin:24px 0;padding:20px;background:#fef2f2;border-radius:12px">
        <span style="font-size:36px;font-weight:800;color:#ef4444">${nota.toFixed(1)}</span>
        <span style="font-size:18px;color:#94a3b8">/5.0</span>
      </div>
      <p style="color:#64748b;font-size:15px;line-height:1.6">
        Has sido devuelto al inicio del módulo <strong>"${moduloTitulo}"</strong>. Debes repasar todo el contenido antes de volver a intentar el cuestionario.
      </p>
      <p style="color:#10b981;font-size:14px;font-weight:600">
        ✅ Tus entregas de archivos ya completadas se mantienen.
      </p>
      <div style="text-align:center;margin:32px 0">
        <a href="${this.appUrl}/dashboard" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;font-size:15px">
          Repasar Módulo
        </a>
      </div>
    `);
    return this.sendMail(email, `Módulo Reiniciado: ${moduloTitulo}`, html);
  }

  /**
   * Wrap content in a styled email template.
   */
  private wrapTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f8fafc">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px">
      <h1 style="color:#ffffff;font-size:18px;margin:0;font-weight:700">Campus Virtual</h1>
    </div>
    <div style="padding:32px">
      ${content}
    </div>
    <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
      <p style="color:#94a3b8;font-size:12px;margin:0">Este es un correo automático, por favor no respondas directamente.</p>
    </div>
  </div>
</body>
</html>`;
  }
}
