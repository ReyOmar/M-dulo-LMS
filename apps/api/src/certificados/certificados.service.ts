import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LmsGateway } from '../ws/lms.gateway';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const CERTS_DIR = path.join(process.cwd(), 'uploads', 'certificados');

@Injectable()
export class CertificadosService {
  private readonly logger = new Logger(CertificadosService.name);
  constructor(
    private prisma: PrismaService,
    private lmsGateway: LmsGateway,
    private configuracionService: ConfiguracionService,
    private notificacionesService: NotificacionesService,
  ) {
    if (!fs.existsSync(CERTS_DIR)) {
      fs.mkdirSync(CERTS_DIR, { recursive: true });
    }
  }

  /**
   * Verify if a student has completed ALL resources in a course.
   * Also checks if all TAREA-type resources have been graded (CALIFICADA).
   */
  async verificarCursoCompleto(usuario_guid: string, curso_guid: string): Promise<{
    completo: boolean;
    completados: number;
    total: number;
    puede_generar_certificado: boolean;
    tareas_pendientes: { recurso_guid: string; titulo: string; fecha_entrega: string | null }[];
  }> {
    const curso = await this.prisma.lms_cursos.findUnique({
      where: { guid: curso_guid },
      include: {
        modulos: {
          orderBy: { orden: 'asc' },
          include: {
            lecciones: {
              include: {
                recursos: { select: { guid: true, tipo: true, titulo: true } },
              },
            },
          },
        },
      },
    });

    if (!curso) throw new NotFoundException('Curso no encontrado');

    const allResources = curso.modulos.flatMap((m) =>
      m.lecciones.flatMap((l) => l.recursos),
    );
    const allResourceGuids = allResources.map((r) => r.guid);

    if (allResourceGuids.length === 0) {
      return { completo: false, completados: 0, total: 0, puede_generar_certificado: false, tareas_pendientes: [] };
    }

    // Check progress (completed resources)
    const completed = await this.prisma.lms_progreso_recurso.findMany({
      where: { usuario_guid, recurso_guid: { in: allResourceGuids } },
      select: { recurso_guid: true },
    });
    const completedSet = new Set(completed.map((c) => c.recurso_guid));
    const completados = allResourceGuids.filter((g) => completedSet.has(g)).length;
    const completo = completados === allResourceGuids.length;

    // Check if all TAREA-type resources have graded submissions
    const tareaResources = allResources.filter((r) => r.tipo === 'TAREA');
    const tareaGuids = tareaResources.map((r) => r.guid);

    let puede_generar_certificado = completo;
    const tareas_pendientes: { recurso_guid: string; titulo: string; fecha_entrega: string | null }[] = [];

    if (tareaGuids.length > 0) {
      // Fetch all submissions for task resources
      const entregas = await this.prisma.lms_entregas.findMany({
        where: {
          usuario_guid,
          tarea_guid: { in: tareaGuids },
        },
        select: { tarea_guid: true, estado: true, fecha_entrega: true },
      });

      const entregaMap = new Map(entregas.map((e) => [e.tarea_guid, e]));

      for (const tarea of tareaResources) {
        const entrega = entregaMap.get(tarea.guid);
        if (!entrega || entrega.estado !== 'CALIFICADA') {
          puede_generar_certificado = false;
          tareas_pendientes.push({
            recurso_guid: tarea.guid,
            titulo: tarea.titulo,
            fecha_entrega: entrega?.fecha_entrega?.toISOString() || null,
          });
        }
      }
    }

    return {
      completo,
      completados,
      total: allResourceGuids.length,
      puede_generar_certificado,
      tareas_pendientes,
    };
  }

  /**
   * Generate a certificate PDF for a student who has completed a course.
   * Idempotent: returns existing certificate if already generated.
   */
  async generarCertificado(usuario_guid: string, curso_guid: string) {
    // Check if certificate already exists
    const existing = await this.prisma.lms_certificados.findUnique({
      where: { usuario_guid_curso_guid: { usuario_guid, curso_guid } },
      include: {
        curso: { select: { titulo: true } },
        usuario: { select: { nombre: true, apellido: true } },
      },
    });
    if (existing) return existing;

    // Verify course completion AND grading
    const verificacion = await this.verificarCursoCompleto(usuario_guid, curso_guid);
    if (!verificacion.completo) {
      throw new BadRequestException('El curso aún no ha sido completado. Debes finalizar todos los recursos.');
    }
    if (!verificacion.puede_generar_certificado) {
      const pendingNames = verificacion.tareas_pendientes.map((t) => `"${t.titulo}"`).join(', ');
      throw new BadRequestException(
        `Tu certificado aún no puede ser generado. Hay ${verificacion.tareas_pendientes.length} tarea(s) pendiente(s) de calificación: ${pendingNames}. El examinador debe calificarlas primero.`,
      );
    }

    // Gather all data needed for the certificate
    const [usuario, curso, matricula, config] = await Promise.all([
      this.prisma.usuarios.findUnique({
        where: { guid: usuario_guid },
        select: { nombre: true, apellido: true, email: true },
      }),
      this.prisma.lms_cursos.findUnique({
        where: { guid: curso_guid },
        select: {
          titulo: true,
          descripcion: true,
          duracion_horas: true,
          profesor_guid: true,
          profesor: { select: { nombre: true, apellido: true, firma_url: true, firma_nombre: true, firma_cargo: true } },
          modulos: {
            include: {
              lecciones: {
                include: {
                  recursos: { select: { guid: true, tipo: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.lms_matriculas.findFirst({
        where: { usuario_guid, curso_guid },
        select: { fecha_matricula: true },
      }),
      this.configuracionService.getConfig(),
    ]);

    if (!usuario || !curso) {
      throw new NotFoundException('Usuario o curso no encontrado.');
    }

    // Calculate metrics
    const allResourceGuids = curso.modulos.flatMap((m) =>
      m.lecciones.flatMap((l) => l.recursos.map((r) => r.guid)),
    );
    const totalModulos = curso.modulos.length;
    const totalRecursos = allResourceGuids.length;
    const totalTareas = curso.modulos.flatMap((m) =>
      m.lecciones.flatMap((l) => l.recursos.filter((r) => r.tipo === 'TAREA')),
    ).length;

    // Calculate average grade from deliveries — use numeric field
    const entregas = await this.prisma.lms_entregas.findMany({
      where: {
        usuario_guid,
        tarea_guid: { in: allResourceGuids },
        estado: 'CALIFICADA',
        calificacion: { not: null },
      },
      select: { calificacion: true },
    });

    let notaPromedio: number | null = null;
    if (entregas.length > 0) {
      let sum = 0;
      let count = 0;
      for (const e of entregas) {
        if (e.calificacion != null) {
          sum += Number(e.calificacion);
          count++;
        }
      }
      if (count > 0) notaPromedio = parseFloat((sum / count).toFixed(2));
    }

    // Get active time (heartbeat-tracked)
    const tiempoActivoResult = await this.prisma.lms_sesion_activa.aggregate({
      where: { usuario_guid, curso_guid },
      _sum: { duracion_seg: true },
    });
    const tiempoActivoSeg = tiempoActivoResult._sum.duracion_seg || 0;
    const tiempoActivoHoras = parseFloat(Math.max(tiempoActivoSeg / 3600, 0.1).toFixed(1));

    const fechaInicio = matricula?.fecha_matricula || new Date();
    const fechaCompletado = new Date();

    // Use active time or course duration as fallback
    const tiempoHoras = tiempoActivoSeg > 0 ? tiempoActivoHoras : (curso.duracion_horas || 1);

    // Generate verification code
    const codigoVerificacion = `CERT-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    // Generate PDF
    const pdfFilename = `certificado-${usuario_guid.substring(0, 8)}-${curso_guid.substring(0, 8)}-${Date.now()}.pdf`;
    const pdfPath = path.join(CERTS_DIR, pdfFilename);

    // Build legal text
    const defaultLegalText = `El presente certificado acredita que el participante cumplió satisfactoriamente con la totalidad del programa de capacitación, el cual constó de ${totalModulos} módulo(s) y ${totalRecursos} recurso(s) formativo(s), incluyendo ${totalTareas} evaluación(es) calificada(s) por el examinador asignado.`;
    const textoLegal = config?.cert_texto_legal || defaultLegalText;

    // Determine logo image path
    let logoImagePath: string | null = null;
    if (config?.logo_url) {
      const fp = path.join(process.cwd(), 'uploads', config.logo_url);
      if (fs.existsSync(fp)) logoImagePath = fp;
    }

    let firmaImagePath: string | null = null;
    if (config?.cert_mostrar_firma && curso.profesor.firma_url) {
      const fp = path.join(process.cwd(), 'uploads', curso.profesor.firma_url);
      if (fs.existsSync(fp)) firmaImagePath = fp;
    }

    await this.generatePDF(pdfPath, {
      nombreEstudiante: `${usuario.nombre} ${usuario.apellido}`,
      tituloCurso: curso.titulo,
      fechaCompletado,
      fechaInicio,
      tiempoHoras,
      notaPromedio,
      codigoVerificacion,
      nombreProfesor: `${curso.profesor.nombre} ${curso.profesor.apellido}`,
      nombrePlataforma: config?.nombre_plataforma || 'Campus Virtual',
      logoImagePath,
      colorPrimario: config?.color_primario || '#4f46e5',
      colorSecundario: config?.color_secundario || '#10b981',
      totalModulos,
      totalRecursos,
      textoLegal,
      tituloPersonalizado: config?.cert_titulo_personalizado || null,
      subtitulo: config?.cert_subtitulo || null,
      mostrarModulos: config?.cert_mostrar_modulos ?? true,
      mostrarRecursos: config?.cert_mostrar_recursos ?? true,
      mostrarNota: config?.cert_mostrar_nota ?? true,
      mostrarFirma: config?.cert_mostrar_firma ?? true,
      mostrarFechaIngreso: config?.cert_mostrar_fecha_ingreso ?? false,
      firmaImagePath,
      firmaNombre: curso.profesor.firma_nombre || null,
      firmaCargo: curso.profesor.firma_cargo || null,
    });

    // Create DB record
    const certificado = await this.prisma.lms_certificados.create({
      data: {
        usuario_guid,
        curso_guid,
        codigo_verificacion: codigoVerificacion,
        archivo_pdf: pdfFilename,
        fecha_inicio: fechaInicio,
        fecha_completado: fechaCompletado,
        tiempo_total_horas: tiempoHoras,
        tiempo_activo_seg: tiempoActivoSeg,
        nota_promedio: notaPromedio,
      },
      include: {
        curso: { select: { titulo: true } },
        usuario: { select: { nombre: true, apellido: true } },
      },
    });

    // Broadcast via WebSocket to the student
    this.lmsGateway.broadcast('certificate:new', {
      guid: certificado.guid,
      curso_guid,
      curso_titulo: curso.titulo,
      fecha_completado: fechaCompletado,
    }, [usuario_guid]);
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'certificate_generated' });

    // Create notification (fire-and-forget)
    this.notificacionesService.crearNotificacion({
      usuario_guid,
      tipo: 'MODULO_COMPLETADO',
      titulo: '🎓 ¡Curso completado!',
      mensaje: `Has finalizado exitosamente el curso "${curso.titulo}". Tu certificado ya está disponible para descargar.`,
      url_accion: '/dashboard/student/certificados',
      ref_tipo: 'certificado',
      ref_guid: certificado.guid,
    }).catch((err) => this.logger.error('Certificate notification error:', err));

    return certificado;
  }

  /**
   * Centralized method: after grading or resource completion, check if the student
   * has now completed all requirements for a certificate.
   * Called by EvaluacionesService, CursosService, and EstudiantesService.
   */
  async checkCertificateAfterGrading(usuario_guid: string, tarea_guid: string) {
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
    const result = await this.verificarCursoCompleto(usuario_guid, curso_guid);
    if (!result.completo || !result.puede_generar_certificado) return;

    // All conditions met — auto-generate certificate!
    await this.generarCertificado(usuario_guid, curso_guid);
    this.logger.log(`Certificate auto-generated after grading for user ${usuario_guid} in course ${curso_guid}`);
  }

  /**
   * Get all certificates for a student.
   */
  async getCertificadosEstudiante(usuario_guid: string) {
    return this.prisma.lms_certificados.findMany({
      where: { usuario_guid },
      include: {
        curso: { select: { titulo: true, imagen_portada: true } },
      },
      orderBy: { fecha_completado: 'desc' },
    });
  }

  /**
   * Get a single certificate by GUID.
   */
  async getCertificado(guid: string) {
    const cert = await this.prisma.lms_certificados.findUnique({
      where: { guid },
      include: {
        curso: { select: { titulo: true, imagen_portada: true } },
        usuario: { select: { nombre: true, apellido: true, email: true } },
      },
    });
    if (!cert) throw new NotFoundException('Certificado no encontrado.');
    return cert;
  }

  /**
   * Get the PDF file path for download.
   */
  getArchivoPDF(filename: string): string {
    const fullPath = path.join(CERTS_DIR, filename);
    if (!fs.existsSync(fullPath)) throw new NotFoundException('Archivo PDF no encontrado.');
    return fullPath;
  }

  // ─── PDF GENERATION ──────────────────────────────────────

  private async generatePDF(
    outputPath: string,
    data: {
      nombreEstudiante: string;
      tituloCurso: string;
      fechaCompletado: Date;
      fechaInicio: Date;
      tiempoHoras: number;
      notaPromedio: number | null;
      codigoVerificacion: string;
      nombreProfesor: string;
      nombrePlataforma: string;
      logoImagePath: string | null;
      colorPrimario: string;
      colorSecundario: string;
      totalModulos: number;
      totalRecursos: number;
      textoLegal: string;
      tituloPersonalizado: string | null;
      subtitulo: string | null;
      mostrarModulos: boolean;
      mostrarRecursos: boolean;
      mostrarNota: boolean;
      mostrarFirma: boolean;
      mostrarFechaIngreso: boolean;
      firmaImagePath: string | null;
      firmaNombre: string | null;
      firmaCargo: string | null;
    },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [842, 595], // A4 Landscape
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
          Title: `Certificado - ${data.tituloCurso}`,
          Author: data.nombrePlataforma,
          Subject: `Certificado de finalización para ${data.nombreEstudiante}`,
        },
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const W = 842;
      const H = 595;
      const primary = data.colorPrimario;
      const secondary = data.colorSecundario;

      // ── Background ──
      doc.rect(0, 0, W, H).fill('#FAFAFA');

      // ── Academic Double Border ──
      doc.rect(24, 24, W - 48, H - 48)
        .lineWidth(3)
        .stroke(primary);
        
      doc.rect(30, 30, W - 60, H - 60)
        .lineWidth(1)
        .stroke(secondary);

      // ── Decorative corner ornaments ──
      this.drawCornerOrnament(doc, 36, 36, primary, false, false);
      this.drawCornerOrnament(doc, W - 36, 36, secondary, true, false);
      this.drawCornerOrnament(doc, 36, H - 36, secondary, false, true);
      this.drawCornerOrnament(doc, W - 36, H - 36, primary, true, true);

      // ── Logo and Platform name header ──
      let headerY = 55;
      
      if (data.logoImagePath) {
        try {
          doc.image(data.logoImagePath, W / 2 - 45, headerY, {
            width: 90,
            height: 90,
            fit: [90, 90],
            align: 'center',
            valign: 'center',
          });
          headerY += 105;
        } catch (e) {
          // Fallback to text if image fails
          doc.fontSize(16)
            .font('Times-Bold')
            .fillColor(primary)
            .text(data.nombrePlataforma.toUpperCase(), 0, headerY, {
              align: 'center',
              width: W,
              characterSpacing: 2,
            });
          headerY += 30;
        }
      } else {
        doc.fontSize(16)
          .font('Times-Bold')
          .fillColor(primary)
          .text(data.nombrePlataforma.toUpperCase(), 0, headerY, {
            align: 'center',
            width: W,
            characterSpacing: 2,
          });
        headerY += 30;
      }

      // ── Horizontal separator after platform name ──
      const sepY = headerY + 10;
      const sepW = 160;
      const sepGrad = doc.linearGradient(W / 2 - sepW / 2, sepY, W / 2 + sepW / 2, sepY);
      sepGrad.stop(0, '#E2E8F0').stop(0.5, primary).stop(1, '#E2E8F0');
      doc.moveTo(W / 2 - sepW / 2, sepY).lineTo(W / 2 + sepW / 2, sepY).lineWidth(1).stroke(sepGrad);

      // ── Title ──
      const certTitle = data.tituloPersonalizado || 'CERTIFICADO';
      doc.fontSize(32)
        .font('Times-Bold')
        .fillColor('#1E293B')
        .text(certTitle, 0, sepY + 15, { align: 'center', width: W });

      const subTitle = data.subtitulo || 'DE FINALIZACIÓN ACADÉMICA';
      doc.fontSize(11)
        .font('Times-Roman')
        .fillColor('#64748B')
        .text(subTitle, 0, sepY + 50, {
          align: 'center',
          width: W,
          characterSpacing: 5,
        });

      // ── "Se otorga a:" ──
      doc.fontSize(12)
        .font('Times-Italic')
        .fillColor('#94A3B8')
        .text('El presente documento se otorga a:', 0, sepY + 80, { align: 'center', width: W });

      // ── Student Name ──
      doc.fontSize(28)
        .font('Times-BoldItalic')
        .fillColor(primary)
        .text(data.nombreEstudiante, 0, sepY + 105, { align: 'center', width: W });

      // ── Decorative line under name ──
      const nameLineY = sepY + 140;
      const nameLineW = Math.min(data.nombreEstudiante.length * 15 + 60, 500);
      const nameGrad = doc.linearGradient(W / 2 - nameLineW / 2, nameLineY, W / 2 + nameLineW / 2, nameLineY);
      nameGrad.stop(0, '#E2E8F0').stop(0.3, primary).stop(0.7, primary).stop(1, '#E2E8F0');
      doc.moveTo(W / 2 - nameLineW / 2, nameLineY)
        .lineTo(W / 2 + nameLineW / 2, nameLineY)
        .lineWidth(1)
        .stroke(nameGrad);

      // ── "Por haber completado exitosamente el curso:" ──
      doc.fontSize(12)
        .font('Times-Italic')
        .fillColor('#64748B')
        .text('Por haber completado y aprobado satisfactoriamente los requisitos del programa formativo:', 0, nameLineY + 15, { align: 'center', width: W });

      // ── Course Title ──
      doc.fontSize(18)
        .font('Times-Bold')
        .fillColor('#1E293B')
        .text(`"${data.tituloCurso}"`, 60, nameLineY + 35, { align: 'center', width: W - 120 });

      // ── Legal / Descriptive text ──
      const legalY = nameLineY + 65;
      doc.fontSize(10)
        .font('Times-Roman')
        .fillColor('#475569')
        .text(data.textoLegal, 80, legalY, { align: 'center', width: W - 160, lineGap: 4 });

      // ── Metrics Row ──
      const metricsY = legalY + 45;
      const metricsData: { label: string; value: string }[] = [];

      const formatDateDDMMYYYY = (d: Date) => {
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      };

      if (data.mostrarFechaIngreso) {
        metricsData.push({
          label: 'Fecha de inscripción',
          value: formatDateDDMMYYYY(data.fechaInicio),
        });
      }

      metricsData.push({
        label: 'Fecha de expedición',
        value: formatDateDDMMYYYY(data.fechaCompletado),
      });

      metricsData.push({
        label: 'Duración',
        value: `${data.tiempoHoras} horas`,
      });
      if (data.mostrarModulos) {
        metricsData.push({ label: 'Módulos', value: `${data.totalModulos}` });
      }
      if (data.mostrarRecursos) {
        metricsData.push({ label: 'Recursos', value: `${data.totalRecursos}` });
      }
      if (data.mostrarNota && data.notaPromedio !== null) {
        metricsData.push({
          label: 'Calificación promedio',
          value: `${data.notaPromedio.toFixed(1)} / 5.0`,
        });
      }

      const metricWidth = (W - 120) / metricsData.length;
      metricsData.forEach((metric, i) => {
        const x = 60 + i * metricWidth;
        doc.fontSize(9)
          .font('Times-Roman')
          .fillColor('#64748B')
          .text(metric.label.toUpperCase(), x, metricsY, { width: metricWidth, align: 'center' });
        doc.fontSize(12)
          .font('Times-Bold')
          .fillColor('#1E293B')
          .text(metric.value, x, metricsY + 14, { width: metricWidth, align: 'center' });
      });

      // ── Instructor signature area ──
      if (data.mostrarFirma) {
        const sigY = H - 110;
        
        // If there's a signature image, render it
        if (data.firmaImagePath) {
          try {
            doc.image(data.firmaImagePath, W / 2 - 60, sigY - 40, {
              width: 120,
              height: 35,
              fit: [120, 35],
              align: 'center',
              valign: 'center',
            });
          } catch (e) {
            // Signature image failed to load, skip silently
          }
        }

        // Signature line
        const sigLineW = 220;
        doc.moveTo(W / 2 - sigLineW / 2, sigY)
          .lineTo(W / 2 + sigLineW / 2, sigY)
          .lineWidth(0.8)
          .stroke('#94A3B8');

        const sigName = data.firmaNombre || data.nombreProfesor;
        doc.fontSize(11)
          .font('Times-Bold')
          .fillColor('#1E293B')
          .text(sigName, 0, sigY + 8, { align: 'center', width: W });

        const sigTitle = data.firmaCargo || 'Instructor / Examinador Académico';
        doc.fontSize(10)
          .font('Times-Italic')
          .fillColor('#64748B')
          .text(sigTitle, 0, sigY + 22, { align: 'center', width: W });
      }

      // ── Verification code at bottom ──
      const codeY = H - 45;
      doc.fontSize(8)
        .font('Times-Roman')
        .fillColor('#94A3B8')
        .text(`Código de verificación institucional: ${data.codigoVerificacion}`, 0, codeY, { align: 'center', width: W });

      // ── Finalize ──
      doc.end();

      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  /**
   * Draw a small corner ornament (L-shaped bracket).
   */
  private drawCornerOrnament(doc: PDFKit.PDFDocument, x: number, y: number, color: string, flipX: boolean, flipY: boolean) {
    const size = 16;
    const dx = flipX ? -1 : 1;
    const dy = flipY ? -1 : 1;

    doc.moveTo(x, y + dy * size)
      .lineTo(x, y)
      .lineTo(x + dx * size, y)
      .lineWidth(2)
      .lineCap('round')
      .stroke(color);
  }

  /**
   * Blend two hex colors by a given ratio (0=color1, 1=color2).
   */
  private blendColors(hex1: string, hex2: string, ratio: number): string {
    const c1 = this.hexToRgb(hex1);
    const c2 = this.hexToRgb(hex2);
    const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
    const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
    const b = Math.round(c1.b + (c2.b - c1.b) * ratio);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    hex = hex.replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  }
}

