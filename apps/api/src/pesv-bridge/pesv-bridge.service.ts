import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { PesvPrismaService } from './pesv-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import { MatriculasService } from '../matriculas/matriculas.service';
import { LmsGateway } from '../ws/lms.gateway';
import { MailService } from '../mail/mail.service';
import { lms_pesv_bridge_estado } from '@prisma/client';
import * as crypto from 'crypto';

/**
 * PesvBridgeService — Core orchestration service for PESV ↔ LMS integration.
 *
 * Responsibilities:
 * 1. Periodically scan PESV database for new infractions (cron job)
 * 2. Auto-enroll infraction conductors in matching LMS courses
 * 3. Listen for certificate generation events to mark infractions as resolved
 * 4. Provide history/stats for admin dashboard
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
   * Can be called by the cron job or manually via the admin API.
   */
  async syncInfracciones(): Promise<{ processed: number; errors: number; skipped: number }> {
    if (this.isSyncing) {
      this.logger.warn('Sync already in progress, skipping...');
      return { processed: 0, errors: 0, skipped: 0 };
    }

    this.isSyncing = true;
    let processed = 0;
    let errors = 0;
    const skipped = 0;

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
          await this.processInfraccion(infraccion);
          processed++;
        } catch (err) {
          errors++;
          this.logger.error(`Error processing infraction ${infraccion.guid}:`, err);
        }
      }

      if (processed > 0) {
        this.logger.log(`✅ Sync complete: ${processed} processed, ${errors} errors, ${skipped} skipped`);
        // Notify admin dashboard of changes
        this.lmsGateway.broadcastToRole('pesv-bridge:sync', { processed, errors }, 'ADMINISTRADOR');
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
  }): Promise<void> {
    const tipoInfraccion = infraccion.tipo_infraccion?.termino || 'Infracción desconocida';

    // Resolve conductor data
    if (!infraccion.conductor) {
      // No conductor linked — register as error
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
      return;
    }

    const conductor = infraccion.conductor;
    // Prefer the user email if conductor has a linked user account, otherwise use email_contacto
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
      return;
    }

    // ── Step 1: Find or create user in LMS ──
    let lmsUser = await this.prisma.usuarios.findUnique({
      where: { email: conductorEmail },
      select: { guid: true, activo: true, deleted_at: true },
    });

    let _invitacionToken: string | null = null;

    if (!lmsUser) {
      // Create user in LMS as ESTUDIANTE (without password — invitation flow)
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      _invitacionToken = rawToken;

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

      // Notify admin about new user
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
      // Course not found — register as pending
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
          mensaje_error: `No se encontró un curso publicado con el título exacto: "${tipoInfraccion}". El administrador debe crear el curso con ese nombre exacto para que la matriculación automática funcione.`,
        },
      });

      this.logger.warn(`  ⚠️ No course found for infraction type: "${tipoInfraccion}"`);
      return;
    }

    // ── Step 3: Enroll user in the course ──
    try {
      await this.matriculasService.matricularEstudiante(matchingCourse.guid, lmsUser.guid);
      this.logger.log(`  ✅ Enrolled ${conductorEmail} in course "${matchingCourse.titulo}"`);
    } catch (err) {
      // Enrollment might fail if already enrolled — that's OK
      this.logger.warn(`  ℹ️ Enrollment note for ${conductorEmail}: ${(err as Error).message}`);
    }

    // ── Step 4: Create bridge record ──
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
  }

  // ═══════════════════════════════════════════════════════════════
  //  EVENT LISTENER — Certificate generated
  // ═══════════════════════════════════════════════════════════════

  /**
   * When a certificate is generated in the LMS, check if the student
   * has any pending bridge records and mark them as resolved.
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
      // Find bridge records for this user+course that are MATRICULADO
      const bridgeRecords = await this.prisma.lms_pesv_bridge_registros.findMany({
        where: {
          lms_usuario_guid: payload.usuario_guid,
          lms_curso_guid: payload.curso_guid,
          estado: 'MATRICULADO',
        },
      });

      if (bridgeRecords.length === 0) return;

      // Mark all matching records as SUBSANADO
      for (const record of bridgeRecords) {
        await this.prisma.lms_pesv_bridge_registros.update({
          where: { id: record.id },
          data: {
            estado: 'SUBSANADO' as lms_pesv_bridge_estado,
            fecha_subsanacion: payload.fecha_completado,
            certificado_guid: payload.certificado_guid,
            codigo_verificacion: payload.codigo_verificacion,
          },
        });

        this.logger.log(
          `🎓 Infraction ${record.pesv_infraccion_guid} marked as SUBSANADO ` +
            `(certificate: ${payload.certificado_guid})`,
        );
      }

      // Notify admin
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
  //  RETRY — Attempt to enroll users with CURSO_NO_ENCONTRADO
  // ═══════════════════════════════════════════════════════════════

  /**
   * Retry enrollment for records where the course was not found.
   * Called by the cron job to handle cases where admin created the course later.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async retryPendingEnrollments() {
    if (process.env.PESV_BRIDGE_ENABLED !== 'true') return;

    const pendingRecords = await this.prisma.lms_pesv_bridge_registros.findMany({
      where: { estado: 'CURSO_NO_ENCONTRADO' },
    });

    if (pendingRecords.length === 0) return;

    this.logger.log(`🔄 Retrying ${pendingRecords.length} pending enrollment(s)...`);

    for (const record of pendingRecords) {
      // Search for a matching course
      const matchingCourse = await this.prisma.lms_cursos.findFirst({
        where: {
          titulo: record.pesv_tipo_infraccion,
          estado: 'PUBLICADO',
          deleted_at: null,
        },
        select: { guid: true, titulo: true },
      });

      if (!matchingCourse) {
        // Still not found — increment retry count
        await this.prisma.lms_pesv_bridge_registros.update({
          where: { id: record.id },
          data: { intentos_sync: { increment: 1 } },
        });
        continue;
      }

      // Course now exists! Enroll the user.
      if (record.lms_usuario_guid) {
        try {
          await this.matriculasService.matricularEstudiante(matchingCourse.guid, record.lms_usuario_guid);
        } catch {
          // Already enrolled or other issue — proceed with update anyway
        }

        await this.prisma.lms_pesv_bridge_registros.update({
          where: { id: record.id },
          data: {
            estado: 'MATRICULADO' as lms_pesv_bridge_estado,
            lms_curso_guid: matchingCourse.guid,
            lms_curso_titulo: matchingCourse.titulo,
            fecha_matriculacion: new Date(),
            mensaje_error: null,
          },
        });

        this.logger.log(`  ✅ Retry successful: enrolled ${record.pesv_conductor_email} in "${matchingCourse.titulo}"`);
      }
    }

    this.lmsGateway.broadcastToRole('dashboard:refresh', { reason: 'pesv_bridge_retry' }, 'ADMINISTRADOR');
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
   */
  async getPendientes() {
    return this.prisma.lms_pesv_bridge_registros.findMany({
      where: { estado: 'CURSO_NO_ENCONTRADO' },
      orderBy: { created_at: 'desc' },
    });
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
