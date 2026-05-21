import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { PesvPrismaService } from './pesv-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import { MatriculasService } from '../matriculas/matriculas.service';
import { LmsGateway } from '../ws/lms.gateway';
import { MailService } from '../mail/mail.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { lms_pesv_bridge_estado } from '@prisma/client';
import * as crypto from 'crypto';

/**
 * PesvBridgeService — Core orchestration service for PESV ↔ LMS integration.
 *
 * Responsibilities:
 * 1. Periodically scan PESV database for new infractions (cron job)
 * 2. Auto-enroll infraction conductors in matching LMS courses
 *    → Deduplication: same conductor + same infraction type = single enrollment
 *    → Multiple infractions of the same type are ALL subsanated with one certificate
 * 3. When no course matches, create in-app admin notifications (not browser)
 *    → Infractions persist with CURSO_NO_ENCONTRADO and retry automatically
 * 4. Listen for certificate generation events to mark infractions as resolved
 * 5. Provide history/stats for admin dashboard
 */
@Injectable()
export class PesvBridgeService {
  private readonly logger = new Logger(PesvBridgeService.name);
  private isSyncing = false;

  constructor(
    private pesvPrisma: PesvPrismaService,
    private prisma: PrismaService,
    private matriculasService: MatriculasService,
    private lmsGateway: LmsGateway,
    private mailService: MailService,
    private notificacionesService: NotificacionesService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  CRON JOB — Sync new infractions every 5 minutes
  // ═══════════════════════════════════════════════════════════════

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCronSync() {
    if (process.env.PESV_BRIDGE_ENABLED !== 'true') return;
    await this.syncInfracciones();
  }

  /**
   * Main sync method — scans PESV for new infractions and processes them.
   *
   * Deduplication strategy:
   * - Each PESV infraction gets its own bridge record (track individually)
   * - But enrollment only happens ONCE per (conductor, tipo_infraccion) pair
   * - If conductor already has MATRICULADO for same tipo, skip re-enrollment
   * - When certificate is generated, ALL infractions of that tipo are SUBSANADO
   */
  async syncInfracciones(): Promise<{ processed: number; errors: number; skipped: number }> {
    if (this.isSyncing) {
      this.logger.warn('Sync already in progress, skipping...');
      return { processed: 0, errors: 0, skipped: 0 };
    }

    this.isSyncing = true;
    let processed = 0;
    let errors = 0;
    let skipped = 0;
    const missingCourses = new Set<string>();

    try {
      // Check PESV connection
      const connected = await this.pesvPrisma.isConnected();
      if (!connected) {
        this.logger.warn('PESV database not available. Sync skipped.');
        return { processed: 0, errors: 0, skipped: 0 };
      }

      // Get all infraction GUIDs already processed
      const processedGuids = await this.prisma.lms_pesv_bridge_registros.findMany({
        select: { pesv_infraccion_guid: true },
      });
      const processedSet = new Set(processedGuids.map((r) => r.pesv_infraccion_guid));

      // Fetch all infractions from PESV with conductor and type data
      const pesvInfracciones = await this.pesvPrisma.infracciones.findMany({
        include: {
          conductor: {
            include: {
              usuario: { select: { email: true, nombre: true, apellido: true } },
            },
          },
          tipo_infraccion: { select: { termino: true } },
          estado: { select: { termino: true } },
        },
      });

      // Filter out already-processed ones
      const newInfracciones = pesvInfracciones.filter((i) => !processedSet.has(i.guid));

      if (newInfracciones.length === 0) {
        return { processed: 0, errors: 0, skipped: 0 };
      }

      this.logger.log(`🔄 Found ${newInfracciones.length} new infraction(s) to process`);

      for (const infraccion of newInfracciones) {
        try {
          const result = await this.processInfraccion(infraccion);
          if (result === 'skipped') {
            skipped++;
          } else {
            processed++;
          }
          if (result === 'course_missing') {
            missingCourses.add(infraccion.tipo_infraccion?.termino || 'Desconocido');
          }
        } catch (err) {
          errors++;
          this.logger.error(`Error processing infraction ${infraccion.guid}:`, err);
        }
      }

      // ── In-app admin notifications ──
      if (missingCourses.size > 0) {
        await this.notifyAdminsMissingCourses(missingCourses);
      }

      if (processed > 0 || skipped > 0) {
        this.logger.log(`✅ Sync complete: ${processed} processed, ${skipped} skipped (dedup), ${errors} errors`);
        // Notify admin dashboard via WebSocket
        this.lmsGateway.broadcastToRole('pesv-bridge:sync', { processed, errors, skipped }, 'ADMINISTRADOR');
        this.lmsGateway.broadcastToRole('dashboard:refresh', { reason: 'pesv_bridge_sync' }, 'ADMINISTRADOR');
      }
    } catch (err) {
      this.logger.error('Fatal sync error:', err);
    } finally {
      this.isSyncing = false;
    }

    return { processed, errors, skipped };
  }

  /**
   * Process a single infraction: resolve conductor data, find/create user, enroll.
   *
   * Returns:
   * - 'enrolled'        — New enrollment created
   * - 'skipped'         — Already enrolled for this tipo (dedup)
   * - 'course_missing'  — No matching course found
   * - 'error'           — Logged as error record
   */
  private async processInfraccion(infraccion: {
    guid: string;
    conductor_guid: string | null;
    fecha_infraccion: Date;
    tipo_infraccion: { termino: string } | null;
    estado: { termino: string } | null;
    conductor: {
      guid: string;
      nombre: string;
      apellido: string;
      email_contacto: string;
      usuario: { email: string; nombre: string; apellido: string } | null;
    } | null;
  }): Promise<'enrolled' | 'skipped' | 'course_missing' | 'error'> {
    const tipoInfraccion = infraccion.tipo_infraccion?.termino || 'Infracción desconocida';

    // ── Validate conductor ──
    if (!infraccion.conductor) {
      await this.prisma.lms_pesv_bridge_registros.create({
        data: {
          pesv_infraccion_guid: infraccion.guid,
          pesv_conductor_guid: 'N/A',
          pesv_tipo_infraccion: tipoInfraccion,
          pesv_conductor_nombre: 'Sin conductor asignado',
          pesv_conductor_email: 'N/A',
          pesv_fecha_infraccion: infraccion.fecha_infraccion,
          estado: 'ERROR' as lms_pesv_bridge_estado,
          mensaje_error: 'La infracción no tiene un conductor asignado en el sistema PESV.',
        },
      });
      return 'error';
    }

    const conductor = infraccion.conductor;
    const conductorEmail = conductor.usuario?.email || conductor.email_contacto;
    const conductorNombre = conductor.usuario?.nombre || conductor.nombre;
    const conductorApellido = conductor.usuario?.apellido || conductor.apellido;
    const conductorNombreCompleto = `${conductorNombre} ${conductorApellido}`;

    if (!conductorEmail || conductorEmail === 'N/A') {
      await this.prisma.lms_pesv_bridge_registros.create({
        data: {
          pesv_infraccion_guid: infraccion.guid,
          pesv_conductor_guid: conductor.guid,
          pesv_tipo_infraccion: tipoInfraccion,
          pesv_conductor_nombre: conductorNombreCompleto,
          pesv_conductor_email: 'Sin correo',
          pesv_fecha_infraccion: infraccion.fecha_infraccion,
          estado: 'ERROR' as lms_pesv_bridge_estado,
          mensaje_error: 'El conductor no tiene un correo electrónico registrado en PESV.',
        },
      });
      return 'error';
    }

    // ── Step 1: Find or create user in LMS ──
    let lmsUser = await this.prisma.usuarios.findUnique({
      where: { email: conductorEmail },
      select: { guid: true, activo: true, deleted_at: true },
    });

    if (!lmsUser) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      lmsUser = await this.prisma.usuarios.create({
        data: {
          email: conductorEmail,
          nombre: conductorNombre,
          apellido: conductorApellido,
          rol: 'ESTUDIANTE',
          contrasena: null,
          usa_clave_defecto: true,
          invitacion_token_hash: tokenHash,
        },
        select: { guid: true, activo: true, deleted_at: true },
      });

      this.logger.log(`  📝 Created LMS user for conductor: ${conductorEmail}`);

      this.lmsGateway.broadcast('user:created', { guid: lmsUser.guid });
      this.lmsGateway.broadcastToRole('dashboard:refresh', { reason: 'pesv_user_created' }, 'ADMINISTRADOR');

      // Send welcome email with invitation token (fire-and-forget)
      this.mailService
        .sendWelcomeEmail(conductorEmail, conductorNombre, rawToken)
        .catch((err) => this.logger.error('Bridge welcome email error:', err));
    }

    // ── Step 2: Find matching course by EXACT title ──
    const matchingCourse = await this.prisma.lms_cursos.findFirst({
      where: {
        titulo: tipoInfraccion,
        estado: 'PUBLICADO',
        deleted_at: null,
      },
      select: { guid: true, titulo: true },
    });

    if (!matchingCourse) {
      // Course not found — register as pending. Account already created above.
      // The student waits until the course is created, then auto-enrolls.
      await this.prisma.lms_pesv_bridge_registros.create({
        data: {
          pesv_infraccion_guid: infraccion.guid,
          pesv_conductor_guid: conductor.guid,
          pesv_tipo_infraccion: tipoInfraccion,
          pesv_conductor_nombre: conductorNombreCompleto,
          pesv_conductor_email: conductorEmail,
          pesv_fecha_infraccion: infraccion.fecha_infraccion,
          lms_usuario_guid: lmsUser.guid,
          estado: 'CURSO_NO_ENCONTRADO' as lms_pesv_bridge_estado,
          mensaje_error: `No se encontró un curso publicado con el título exacto: "${tipoInfraccion}". Cree el curso con ese nombre exacto o contacte al administrador.`,
        },
      });

      // Individual email to ALL admins for THIS specific person
      this.notifyAdminMissingCourseForPerson(conductorNombreCompleto, conductorEmail, tipoInfraccion).catch((err) =>
        this.logger.error('Admin notification error:', err),
      );

      this.logger.warn(`  ⚠️ No course found for infraction type: "${tipoInfraccion}"`);
      return 'course_missing';
    }

    // ── Step 3: Deduplication check ──
    // If this conductor already has a MATRICULADO or SUBSANADO record for the
    // same tipo_infraccion, don't re-enroll — just link the new infraction.
    const existingEnrollment = await this.prisma.lms_pesv_bridge_registros.findFirst({
      where: {
        pesv_conductor_email: conductorEmail,
        pesv_tipo_infraccion: tipoInfraccion,
        estado: { in: ['MATRICULADO', 'SUBSANADO'] },
      },
      select: { lms_curso_guid: true, lms_curso_titulo: true, estado: true, fecha_matriculacion: true },
    });

    if (existingEnrollment) {
      // Already enrolled for this tipo — create record linked to same course,
      // but skip the actual enrollment call. Subsanation will cover all records.
      await this.prisma.lms_pesv_bridge_registros.create({
        data: {
          pesv_infraccion_guid: infraccion.guid,
          pesv_conductor_guid: conductor.guid,
          pesv_tipo_infraccion: tipoInfraccion,
          pesv_conductor_nombre: conductorNombreCompleto,
          pesv_conductor_email: conductorEmail,
          pesv_fecha_infraccion: infraccion.fecha_infraccion,
          lms_usuario_guid: lmsUser.guid,
          lms_curso_guid: existingEnrollment.lms_curso_guid,
          lms_curso_titulo: existingEnrollment.lms_curso_titulo,
          estado: existingEnrollment.estado as lms_pesv_bridge_estado,
          fecha_matriculacion: existingEnrollment.fecha_matriculacion,
          // If already SUBSANADO, inherit that status for the new infraction too
        },
      });

      this.logger.log(
        `  ♻️ Dedup: ${conductorEmail} already enrolled for "${tipoInfraccion}" — linked infraction ${infraccion.guid}`,
      );
      return 'skipped';
    }

    // ── Step 4: Enroll user in the course ──
    try {
      await this.matriculasService.matricularEstudiante(matchingCourse.guid, lmsUser.guid);
      this.logger.log(`  ✅ Enrolled ${conductorEmail} in course "${matchingCourse.titulo}"`);
    } catch (err) {
      // Enrollment might fail if already enrolled through other means — that's OK
      this.logger.warn(`  ℹ️ Enrollment note for ${conductorEmail}: ${(err as Error).message}`);
    }

    // ── Step 5: Create bridge record ──
    await this.prisma.lms_pesv_bridge_registros.create({
      data: {
        pesv_infraccion_guid: infraccion.guid,
        pesv_conductor_guid: conductor.guid,
        pesv_tipo_infraccion: tipoInfraccion,
        pesv_conductor_nombre: conductorNombreCompleto,
        pesv_conductor_email: conductorEmail,
        pesv_fecha_infraccion: infraccion.fecha_infraccion,
        lms_usuario_guid: lmsUser.guid,
        lms_curso_guid: matchingCourse.guid,
        lms_curso_titulo: matchingCourse.titulo,
        estado: 'MATRICULADO' as lms_pesv_bridge_estado,
        fecha_matriculacion: new Date(),
      },
    });

    return 'enrolled';
  }

  // ═══════════════════════════════════════════════════════════════
  //  IN-APP + EMAIL NOTIFICATIONS — Admin alerts for missing courses
  // ═══════════════════════════════════════════════════════════════

  /**
   * Batch notification: summary of ALL missing course types found during a sync.
   * In-app only (individual emails are sent per person below).
   */
  private async notifyAdminsMissingCourses(missingCourseTypes: Set<string>) {
    const admins = await this.prisma.usuarios.findMany({
      where: { rol: 'ADMINISTRADOR', activo: true, deleted_at: null },
      select: { guid: true },
    });

    if (admins.length === 0) return;

    const courseList = [...missingCourseTypes].map((t) => `• ${t}`).join('\n');
    const count = missingCourseTypes.size;

    const titulo = `⚠️ PESV: ${count} tipo${count > 1 ? 's' : ''} de infracción sin curso`;
    const mensaje =
      `Se detectaron infracciones del PESV pero no existen cursos con el nombre exacto:\n\n` +
      `${courseList}\n\n` +
      `Cree los cursos con esos nombres exactos para que la matriculación automática funcione. ` +
      `Las infracciones persisten y se reintentarán automáticamente.`;

    for (const admin of admins) {
      await this.notificacionesService.crearNotificacion({
        usuario_guid: admin.guid,
        tipo: 'PESV_ALERTA',
        titulo,
        mensaje,
        url_accion: '/dashboard/admin/solicitudes',
        ref_tipo: 'pesv_bridge',
        ref_guid: 'curso_no_encontrado',
      });
    }

    this.logger.log(`  🔔 Notified ${admins.length} admin(s) about ${count} missing course type(s)`);
  }

  /**
   * Individual notification: sent per EACH person who could not be enrolled.
   * Sends both in-app notification AND email to every active admin.
   */
  private async notifyAdminMissingCourseForPerson(
    conductorNombre: string,
    conductorEmail: string,
    tipoInfraccion: string,
  ) {
    const admins = await this.prisma.usuarios.findMany({
      where: { rol: 'ADMINISTRADOR', activo: true, deleted_at: null },
      select: { guid: true, email: true, nombre: true },
    });

    if (admins.length === 0) return;

    for (const admin of admins) {
      // In-app notification
      await this.notificacionesService.crearNotificacion({
        usuario_guid: admin.guid,
        tipo: 'PESV_ALERTA',
        titulo: `⚠️ ${conductorNombre} no pudo ser matriculado`,
        mensaje:
          `El conductor ${conductorNombre} (${conductorEmail}) tiene una infracción de tipo ` +
          `"${tipoInfraccion}" pero no existe un curso publicado con ese nombre exacto en el LMS. ` +
          `Su cuenta fue creada pero no podrá iniciar capacitación hasta que el curso esté disponible.`,
        url_accion: '/dashboard/admin/solicitudes',
        ref_tipo: 'pesv_bridge',
        ref_guid: `missing_${tipoInfraccion}`,
      });

      // Email notification
      this.mailService
        .sendMail(
          admin.email,
          `⚠️ PESV: ${conductorNombre} sin curso disponible`,
          `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #d97706;">⚠️ Conductor sin curso disponible</h2>
            <p>Hola ${admin.nombre},</p>
            <p>El conductor <strong>${conductorNombre}</strong> (<a href="mailto:${conductorEmail}">${conductorEmail}</a>) 
               tiene una infracción de tipo:</p>
            <div style="background: #fef3c7; border-radius: 8px; padding: 12px 20px; margin: 16px 0; font-weight: bold; font-size: 16px;">
              "${tipoInfraccion}"
            </div>
            <p>Se creó su cuenta en el LMS, pero <strong>no existe un curso publicado con ese nombre exacto</strong>.</p>
            <p>Para que ${conductorNombre} pueda subsanar su infracción:</p>
            <ol style="line-height: 1.8;">
              <li>Ingrese al LMS como administrador</li>
              <li>Cree un curso con el título exacto: <strong>"${tipoInfraccion}"</strong></li>
              <li>Publíquelo — la matrícula se realizará <strong>automáticamente</strong></li>
            </ol>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #9ca3af; font-size: 12px;">Este correo fue enviado automáticamente por el módulo PESV Bridge del LMS.</p>
          </div>`,
        )
        .catch((err) => this.logger.error('Bridge per-person email error:', err));
    }

    this.logger.log(`  📧 Notified admins about missing course for ${conductorNombre}`);
  }

  // ═══════════════════════════════════════════════════════════════
  //  URGENT REMINDER — 3-day follow-up for unresolved missing courses
  // ═══════════════════════════════════════════════════════════════

  /**
   * Every day at 9:00 AM, check for CURSO_NO_ENCONTRADO records older than 3 days.
   * If found, send an URGENT email to all admins reminding them that students are waiting.
   */
  @Cron('0 9 * * *') // Daily at 09:00
  async sendUrgentRemindersForStalePending() {
    if (process.env.PESV_BRIDGE_ENABLED !== 'true') return;

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const staleRecords = await this.prisma.lms_pesv_bridge_registros.findMany({
      where: {
        estado: 'CURSO_NO_ENCONTRADO',
        created_at: { lte: threeDaysAgo },
      },
      orderBy: { created_at: 'asc' },
    });

    if (staleRecords.length === 0) return;

    // Group by tipo_infraccion for cleaner notification
    const grouped = new Map<string, { conductores: string[]; oldestDate: Date }>();
    for (const r of staleRecords) {
      const existing = grouped.get(r.pesv_tipo_infraccion);
      if (existing) {
        if (!existing.conductores.includes(r.pesv_conductor_nombre)) {
          existing.conductores.push(r.pesv_conductor_nombre);
        }
      } else {
        grouped.set(r.pesv_tipo_infraccion, {
          conductores: [r.pesv_conductor_nombre],
          oldestDate: r.created_at,
        });
      }
    }

    const admins = await this.prisma.usuarios.findMany({
      where: { rol: 'ADMINISTRADOR', activo: true, deleted_at: null },
      select: { guid: true, email: true, nombre: true },
    });

    if (admins.length === 0) return;

    const courseItems = [...grouped.entries()]
      .map(([tipo, data]) => {
        const days = Math.floor((Date.now() - data.oldestDate.getTime()) / (24 * 60 * 60 * 1000));
        return `<li><strong>"${tipo}"</strong> — ${data.conductores.length} persona(s) esperando desde hace ${days} día(s): ${data.conductores.join(', ')}</li>`;
      })
      .join('');

    for (const admin of admins) {
      // Urgent in-app notification
      await this.notificacionesService.crearNotificacion({
        usuario_guid: admin.guid,
        tipo: 'PESV_ALERTA',
        titulo: `🚨 URGENTE: ${staleRecords.length} estudiante(s) esperan curso hace +3 días`,
        mensaje:
          `Hay ${staleRecords.length} conductor(es) con infracciones del PESV que no han podido ` +
          `ser matriculados porque los cursos correspondientes no existen. Llevan más de 3 días esperando. ` +
          `Por favor, cree los cursos necesarios lo antes posible.`,
        url_accion: '/dashboard/admin/solicitudes',
        ref_tipo: 'pesv_bridge',
        ref_guid: 'urgent_reminder',
      });

      // Urgent email
      this.mailService
        .sendMail(
          admin.email,
          `🚨 URGENTE: Estudiantes PESV esperan curso hace más de 3 días`,
          `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="background: #dc2626; color: white; padding: 16px 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h2 style="margin: 0;">🚨 Acción URGENTE Requerida</h2>
            </div>
            <div style="border: 2px solid #dc2626; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
              <p>Hola ${admin.nombre},</p>
              <p>Hay <strong>${staleRecords.length} conductor(es)</strong> con infracciones del PESV que 
                 <strong>llevan más de 3 días sin poder iniciar su capacitación</strong> porque los cursos 
                 correspondientes no existen en el LMS:</p>
              <ul style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px 32px; margin: 16px 0;">${courseItems}</ul>
              <p>Estas personas ya tienen cuenta en el LMS pero <strong>no pueden hacer nada</strong> hasta que 
                 se creen los cursos. Apenas publique el curso, la matrícula será automática.</p>
              <p style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; font-size: 13px;">
                💡 <strong>Tip:</strong> Al crear y publicar el curso con el nombre exacto, todos los conductores 
                en espera serán matriculados automáticamente e inmediatamente.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
              <p style="color: #9ca3af; font-size: 12px;">Este recordatorio se envía diariamente mientras haya estudiantes esperando más de 3 días.</p>
            </div>
          </div>`,
        )
        .catch((err) => this.logger.error('Urgent reminder email error:', err));
    }

    this.logger.log(
      `  🚨 Sent urgent reminders to ${admins.length} admin(s) for ${staleRecords.length} stale record(s)`,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  EVENT LISTENER — Certificate generated → subsanate ALL
  // ═══════════════════════════════════════════════════════════════

  /**
   * When a certificate is generated in the LMS, check if the student
   * has any pending bridge records and mark ALL of them as resolved.
   *
   * Key: One certificate covers ALL infractions of the same tipo for
   * the same conductor. If conductor had 3 speed infractions, completing
   * the speed course subsanates all 3.
   */
  @OnEvent('certificate.generated', { async: true })
  async onCertificateGenerated(payload: {
    usuario_guid: string;
    curso_guid: string;
    certificado_guid: string;
    codigo_verificacion: string;
    fecha_completado: Date;
  }) {
    try {
      // Find ALL bridge records for this user+course that are MATRICULADO
      const bridgeRecords = await this.prisma.lms_pesv_bridge_registros.findMany({
        where: {
          lms_usuario_guid: payload.usuario_guid,
          lms_curso_guid: payload.curso_guid,
          estado: 'MATRICULADO',
        },
      });

      if (bridgeRecords.length === 0) return;

      // Mark ALL matching records as SUBSANADO + write-back to PESV
      for (const record of bridgeRecords) {
        // Step 1: Mark as SUBSANADO in LMS bridge table
        await this.prisma.lms_pesv_bridge_registros.update({
          where: { id: record.id },
          data: {
            estado: 'SUBSANADO' as lms_pesv_bridge_estado,
            fecha_subsanacion: payload.fecha_completado,
            certificado_guid: payload.certificado_guid,
            codigo_verificacion: payload.codigo_verificacion,
          },
        });

        // Step 2: Write-back to PESV — update infracción estado to SUBSANADA
        const pesvUpdated = await this.pesvPrisma.subsanarInfraccion(record.pesv_infraccion_guid);

        // Track whether the PESV update succeeded
        await this.prisma.lms_pesv_bridge_registros.update({
          where: { id: record.id },
          data: { pesv_actualizado: pesvUpdated },
        });

        this.logger.log(
          `🎓 Infraction ${record.pesv_infraccion_guid} → SUBSANADO ` +
            `(PESV write-back: ${pesvUpdated ? '✅' : '❌'})`,
        );
      }

      // In-app notification to admins
      const admins = await this.prisma.usuarios.findMany({
        where: { rol: 'ADMINISTRADOR', activo: true, deleted_at: null },
        select: { guid: true, email: true, nombre: true },
      });

      const conductorNombre = bridgeRecords[0].pesv_conductor_nombre;
      const tipoInfraccion = bridgeRecords[0].pesv_tipo_infraccion;

      for (const admin of admins) {
        await this.notificacionesService.crearNotificacion({
          usuario_guid: admin.guid,
          tipo: 'PESV_ALERTA',
          titulo: '🎓 Infracción subsanada',
          mensaje:
            `${conductorNombre} completó el curso "${tipoInfraccion}" y se subsanaron ` +
            `${bridgeRecords.length} infracción(es). El estado fue actualizado en el PESV.`,
          url_accion: '/dashboard/admin/pesv-bridge',
          ref_tipo: 'pesv_bridge',
          ref_guid: payload.certificado_guid,
        });
      }

      // Notify admin dashboard via WebSocket
      this.lmsGateway.broadcastToRole(
        'pesv-bridge:subsanacion',
        {
          count: bridgeRecords.length,
          usuario_guid: payload.usuario_guid,
          curso_guid: payload.curso_guid,
        },
        'ADMINISTRADOR',
      );
      this.lmsGateway.broadcastToRole('dashboard:refresh', { reason: 'pesv_bridge_subsanacion' }, 'ADMINISTRADOR');
    } catch (err) {
      this.logger.error('Error handling certificate event for bridge:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  EVENT LISTENER — Course published → auto-enroll waiting students
  // ═══════════════════════════════════════════════════════════════

  /**
   * When a course is published, check if there are CURSO_NO_ENCONTRADO records
   * whose tipo_infraccion matches the course title. If so, auto-enroll them
   * immediately and notify each student by email.
   *
   * This is the PRIMARY auto-enrollment mechanism — fires in real-time.
   * The cron retry is a safety net for edge cases.
   */
  @OnEvent('course.published', { async: true })
  async onCoursePublished(payload: { curso_guid: string; titulo: string }) {
    try {
      // Find all CURSO_NO_ENCONTRADO records matching this course title
      const pendingRecords = await this.prisma.lms_pesv_bridge_registros.findMany({
        where: {
          estado: 'CURSO_NO_ENCONTRADO',
          pesv_tipo_infraccion: payload.titulo,
        },
      });

      if (pendingRecords.length === 0) return;

      this.logger.log(`📢 Course "${payload.titulo}" published — found ${pendingRecords.length} waiting student(s)`);

      await this.enrollPendingRecords(pendingRecords, payload.curso_guid, payload.titulo);
    } catch (err) {
      this.logger.error(`Error processing course.published for "${payload.titulo}":`, err);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  RETRY CRON — Safety net for CURSO_NO_ENCONTRADO (every 10min)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fallback retry: every 10 minutes, check if any published course now matches
   * a CURSO_NO_ENCONTRADO record. This covers edge cases where the event might
   * have been missed (server restart during publish, etc.).
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async retryPendingEnrollments() {
    if (process.env.PESV_BRIDGE_ENABLED !== 'true') return;

    const pendingRecords = await this.prisma.lms_pesv_bridge_registros.findMany({
      where: { estado: 'CURSO_NO_ENCONTRADO' },
    });

    if (pendingRecords.length === 0) return;

    // Group by tipo_infraccion to batch-check courses
    const byTipo = new Map<string, typeof pendingRecords>();
    for (const r of pendingRecords) {
      const list = byTipo.get(r.pesv_tipo_infraccion) || [];
      list.push(r);
      byTipo.set(r.pesv_tipo_infraccion, list);
    }

    let totalResolved = 0;

    for (const [tipo, records] of byTipo) {
      const matchingCourse = await this.prisma.lms_cursos.findFirst({
        where: { titulo: tipo, estado: 'PUBLICADO', deleted_at: null },
        select: { guid: true, titulo: true },
      });

      if (matchingCourse) {
        const resolved = await this.enrollPendingRecords(records, matchingCourse.guid, matchingCourse.titulo);
        totalResolved += resolved;
      } else {
        // Still not found — increment retry counters
        for (const r of records) {
          await this.prisma.lms_pesv_bridge_registros.update({
            where: { id: r.id },
            data: { intentos_sync: { increment: 1 } },
          });
        }
      }
    }

    if (totalResolved > 0) {
      this.lmsGateway.broadcastToRole('dashboard:refresh', { reason: 'pesv_bridge_retry' }, 'ADMINISTRADOR');
    }
  }

  /**
   * Shared logic: enroll a list of CURSO_NO_ENCONTRADO records into a course.
   * Handles deduplication, actual enrollment, bridge record updates,
   * student email notifications, and admin notifications.
   *
   * @returns number of records resolved
   */
  private async enrollPendingRecords(
    records: Array<{
      id: number;
      pesv_conductor_email: string;
      pesv_conductor_nombre: string;
      pesv_tipo_infraccion: string;
      lms_usuario_guid: string | null;
    }>,
    cursoGuid: string,
    cursoTitulo: string,
  ): Promise<number> {
    let resolved = 0;

    for (const record of records) {
      if (!record.lms_usuario_guid) continue;

      // Dedup check: is this conductor already enrolled for this tipo?
      const existingEnrollment = await this.prisma.lms_pesv_bridge_registros.findFirst({
        where: {
          pesv_conductor_email: record.pesv_conductor_email,
          pesv_tipo_infraccion: record.pesv_tipo_infraccion,
          estado: { in: ['MATRICULADO', 'SUBSANADO'] },
          id: { not: record.id },
        },
      });

      if (!existingEnrollment) {
        // Actually enroll
        try {
          await this.matriculasService.matricularEstudiante(cursoGuid, record.lms_usuario_guid);
        } catch {
          // Already enrolled through other means — OK
        }

        // Send enrollment email to the student
        this.mailService
          .sendEnrollmentNotification(record.pesv_conductor_email, record.pesv_conductor_nombre, cursoTitulo, cursoGuid)
          .catch((err) => this.logger.error('Enrollment email error:', err));
      }

      // Update bridge record
      await this.prisma.lms_pesv_bridge_registros.update({
        where: { id: record.id },
        data: {
          estado: (existingEnrollment?.estado || 'MATRICULADO') as lms_pesv_bridge_estado,
          lms_curso_guid: cursoGuid,
          lms_curso_titulo: cursoTitulo,
          fecha_matriculacion: existingEnrollment?.fecha_matriculacion || new Date(),
          mensaje_error: null,
        },
      });

      resolved++;
      this.logger.log(`  ✅ Auto-enrolled: ${record.pesv_conductor_email} → "${cursoTitulo}"`);
    }

    if (resolved > 0) {
      // Notify admins about resolved enrollments
      const admins = await this.prisma.usuarios.findMany({
        where: { rol: 'ADMINISTRADOR', activo: true, deleted_at: null },
        select: { guid: true },
      });

      for (const admin of admins) {
        await this.notificacionesService.crearNotificacion({
          usuario_guid: admin.guid,
          tipo: 'PESV_ALERTA',
          titulo: `✅ ${resolved} matrícula(s) PESV auto-resueltas`,
          mensaje:
            `El curso "${cursoTitulo}" fue publicado y se matricularon automáticamente ` +
            `${resolved} conductor(es) que estaban en espera. Se les notificó por correo electrónico.`,
          url_accion: '/dashboard/admin/solicitudes',
          ref_tipo: 'pesv_bridge',
          ref_guid: 'auto_resolved',
        });
      }

      this.lmsGateway.broadcastToRole('pesv-bridge:sync', { resolved }, 'ADMINISTRADOR');
      this.lmsGateway.broadcastToRole('dashboard:refresh', { reason: 'pesv_auto_enroll' }, 'ADMINISTRADOR');
    }

    return resolved;
  }

  // ═══════════════════════════════════════════════════════════════
  //  QUERY METHODS — For admin dashboard
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get all bridge records with optional filters.
   */
  async getRegistros(filters?: { estado?: lms_pesv_bridge_estado; search?: string; page?: number; limit?: number }) {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters?.estado) {
      where.estado = filters.estado;
    }

    if (filters?.search) {
      const search = filters.search;
      where.OR = [
        { pesv_conductor_nombre: { contains: search } },
        { pesv_conductor_email: { contains: search } },
        { pesv_tipo_infraccion: { contains: search } },
        { lms_curso_titulo: { contains: search } },
      ];
    }

    const [registros, total] = await Promise.all([
      this.prisma.lms_pesv_bridge_registros.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.lms_pesv_bridge_registros.count({ where }),
    ]);

    return { registros, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Get records where courses have not been found (alert for admin).
   * Groups by tipo_infraccion to show unique missing courses.
   */
  async getPendientes() {
    const records = await this.prisma.lms_pesv_bridge_registros.findMany({
      where: { estado: 'CURSO_NO_ENCONTRADO' },
      orderBy: { created_at: 'desc' },
    });

    // Group by tipo_infraccion for summary
    const grouped = new Map<string, { tipo: string; count: number; conductores: string[] }>();
    for (const r of records) {
      const existing = grouped.get(r.pesv_tipo_infraccion);
      if (existing) {
        existing.count++;
        if (!existing.conductores.includes(r.pesv_conductor_nombre)) {
          existing.conductores.push(r.pesv_conductor_nombre);
        }
      } else {
        grouped.set(r.pesv_tipo_infraccion, {
          tipo: r.pesv_tipo_infraccion,
          count: 1,
          conductores: [r.pesv_conductor_nombre],
        });
      }
    }

    return {
      registros: records,
      resumen: [...grouped.values()],
      total: records.length,
    };
  }

  /**
   * Get summary statistics for the admin dashboard.
   */
  async getStats() {
    const [total, matriculados, subsanados, cursoNoEncontrado, errores] = await Promise.all([
      this.prisma.lms_pesv_bridge_registros.count(),
      this.prisma.lms_pesv_bridge_registros.count({ where: { estado: 'MATRICULADO' } }),
      this.prisma.lms_pesv_bridge_registros.count({ where: { estado: 'SUBSANADO' } }),
      this.prisma.lms_pesv_bridge_registros.count({ where: { estado: 'CURSO_NO_ENCONTRADO' } }),
      this.prisma.lms_pesv_bridge_registros.count({ where: { estado: 'ERROR' } }),
    ]);

    const pesvConnected = await this.pesvPrisma.isConnected();

    return {
      total,
      matriculados,
      subsanados,
      cursoNoEncontrado,
      errores,
      pesvConnected,
      bridgeEnabled: process.env.PESV_BRIDGE_ENABLED === 'true',
    };
  }
}
