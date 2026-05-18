import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { LmsGateway } from '../ws/lms.gateway';

/**
 * QuizService — Quiz attempt management (start, evaluate, status, enrollment check).
 * Extracted from CursosService. Uses event-driven architecture for notifications.
 */
@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);
  constructor(
    private prisma: PrismaService,
    private lmsGateway: LmsGateway,
    private eventEmitter: EventEmitter2,
  ) {}

  async startQuiz(recurso_guid: string, usuario_guid: string) {
    const bloque = await this.prisma.lms_recursos.findUnique({ where: { guid: recurso_guid } });
    if (!bloque || bloque.tipo !== 'TAREA' || !bloque.quiz_config) {
      throw new BadRequestException('El recurso no es un cuestionario válido.');
    }

    let quizConfig: any;
    try {
      quizConfig = JSON.parse(bloque.quiz_config);
    } catch {
      throw new BadRequestException('Configuración de cuestionario corrupta.');
    }

    return this.prisma.$transaction(async (tx) => {
      const enProgreso = await tx.lms_entregas.findFirst({
        where: { tarea_guid: recurso_guid, usuario_guid, estado: 'BORRADOR' },
      });
      if (enProgreso) return { success: true, guid: enProgreso.guid, fecha_inicio: enProgreso.fecha_inicio };

      // Clean up stale attempts from a previous module reset.
      // When a student fails a quiz, their module progress is reset (lms_progreso_recurso deleted)
      // but old CALIFICADA delivery records may still exist. These stale records would incorrectly
      // count towards the attempt limit, blocking the student from retrying.
      // Detection: if there are graded attempts but NO progress record, the module was reset.
      const [existingAttempts, progressRecord] = await Promise.all([
        tx.lms_entregas.count({
          where: {
            tarea_guid: recurso_guid,
            usuario_guid,
            estado: { in: ['CALIFICADA', 'ENTREGADA', 'ENTREGADA_TARDE'] },
          },
        }),
        tx.lms_progreso_recurso.findFirst({
          where: { usuario_guid, recurso_guid },
        }),
      ]);

      if (existingAttempts > 0 && !progressRecord) {
        // Stale state detected: old attempts exist but quiz hasn't been passed.
        // This means the module was reset — clean up old delivery records.
        this.logger.log(
          `Cleaning up ${existingAttempts} stale quiz attempt(s) for user ${usuario_guid} on resource ${recurso_guid} after module reset`,
        );
        await tx.lms_entregas.deleteMany({
          where: {
            tarea_guid: recurso_guid,
            usuario_guid,
            estado: { in: ['CALIFICADA', 'ENTREGADA', 'ENTREGADA_TARDE'] },
          },
        });
      }

      // Count valid attempts (after cleanup)
      const prevAttempts = existingAttempts > 0 && !progressRecord ? 0 : existingAttempts;

      const maxIntentos = quizConfig.intentos_permitidos || 0;
      if (maxIntentos > 0 && prevAttempts >= maxIntentos) {
        throw new BadRequestException(`Has alcanzado el límite de ${maxIntentos} intento(s) para este cuestionario.`);
      }

      const nueva = await tx.lms_entregas.create({
        data: {
          usuario_guid,
          tarea_guid: recurso_guid,
          estado: 'BORRADOR',
          fecha_inicio: new Date(),
          intento_numero: prevAttempts + 1,
        },
      });

      return { success: true, guid: nueva.guid, fecha_inicio: nueva.fecha_inicio };
    });
  }

  async evaluarQuiz(recurso_guid: string, usuario_guid: string, respuestas: Record<string, string>) {
    const bloque = await this.prisma.lms_recursos.findUnique({
      where: { guid: recurso_guid },
      include: {
        leccion: {
          select: {
            modulo: {
              select: {
                curso: { select: { nota_aprobacion: true } },
              },
            },
          },
        },
      },
    });
    if (!bloque || bloque.tipo !== 'TAREA' || !bloque.quiz_config) {
      throw new BadRequestException('El recurso no es un cuestionario válido.');
    }

    const notaAprobacion = bloque.leccion?.modulo?.curso?.nota_aprobacion
      ? Number(bloque.leccion.modulo.curso.nota_aprobacion)
      : 3.0;

    let quizConfig: any;
    try {
      quizConfig = JSON.parse(bloque.quiz_config);
    } catch {
      throw new BadRequestException('Configuración de cuestionario corrupta.');
    }

    // BUG-03 FIX: Validate time limit
    const tiempoMinutos = quizConfig.tiempo_minutos || 0;
    let tiempoExcedido = false;
    if (tiempoMinutos > 0) {
      const enProgreso = await this.prisma.lms_entregas.findFirst({
        where: { tarea_guid: recurso_guid, usuario_guid, estado: 'BORRADOR' },
      });
      if (enProgreso?.fecha_inicio) {
        const tiempoLimiteMs = tiempoMinutos * 60 * 1000;
        const tiempoTranscurrido = Date.now() - new Date(enProgreso.fecha_inicio).getTime();
        if (tiempoTranscurrido > tiempoLimiteMs + 30000) {
          this.logger.warn(`Quiz time exceeded for user ${usuario_guid} on resource ${recurso_guid}`);
          tiempoExcedido = true;
        }
      }
    }

    const preguntas = quizConfig.preguntas || [];
    let correctas = 0;
    const total = preguntas.length;

    if (!tiempoExcedido) {
      for (const p of preguntas) {
        const userAnswer = respuestas[p.id];
        const correctOption = p.opciones.find((o: any) => o.es_correcta);
        if (correctOption && userAnswer === correctOption.id) {
          correctas++;
        }
      }
    }

    let nota = 0;
    if (total > 0 && !tiempoExcedido) {
      nota = parseFloat(((correctas / total) * 5).toFixed(1));
    }

    // Atomic update — only transitions BORRADOR→CALIFICADA once.
    // If a concurrent submit already transitioned this, updateMany returns count=0.
    const updateResult = await this.prisma.lms_entregas.updateMany({
      where: { tarea_guid: recurso_guid, usuario_guid, estado: 'BORRADOR' },
      data: {
        estado: 'CALIFICADA',
        fecha_entrega: new Date(),
        calificacion: nota,
        comentario_calificacion: `${correctas}/${total} correctas`,
        contenido_texto: `NOTA: ${nota.toFixed(1)} | ${correctas}/${total} correctas`,
      },
    });

    if (updateResult.count === 0) {
      // No BORRADOR found — either already submitted or no attempt started
      // Check if there's a recently graded attempt to return its result
      const recent = await this.prisma.lms_entregas.findFirst({
        where: { tarea_guid: recurso_guid, usuario_guid, estado: 'CALIFICADA' },
        orderBy: { fecha_entrega: 'desc' },
        select: { calificacion: true },
      });
      if (recent) {
        return { success: true, nota: Number(recent.calificacion), correctas: 0, total, already_submitted: true };
      }
      // Fallback: create a new graded record (legacy path)
      await this.prisma.lms_entregas.create({
        data: {
          usuario_guid,
          tarea_guid: recurso_guid,
          estado: 'CALIFICADA',
          fecha_inicio: new Date(),
          fecha_entrega: new Date(),
          calificacion: nota,
          comentario_calificacion: `${correctas}/${total} correctas`,
          contenido_texto: `NOTA: ${nota.toFixed(1)} | ${correctas}/${total} correctas`,
        },
      });
    }

    const quizName = bloque.titulo.replace('[QUIZ] ', '');

    if (nota >= notaAprobacion) {
      const existente = await this.prisma.lms_progreso_recurso.findFirst({
        where: { usuario_guid, recurso_guid },
      });
      if (!existente) {
        await this.prisma.lms_progreso_recurso.create({
          data: { usuario_guid, recurso_guid },
        });
      }

      // Emit event instead of direct service calls
      this.eventEmitter.emit('quiz.passed', {
        usuario_guid,
        recurso_guid,
        nota,
        titulo_quiz: quizName,
      });
    } else {
      // FAILED: Reset module progress
      const recursoConModulo = await this.prisma.lms_recursos.findUnique({
        where: { guid: recurso_guid },
        select: {
          leccion: {
            select: {
              modulo: {
                select: {
                  guid: true,
                  titulo: true,
                  curso: { select: { guid: true, titulo: true, profesor_guid: true } },
                  lecciones: {
                    select: {
                      recursos: {
                        select: { guid: true, titulo: true, tipo: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (recursoConModulo) {
        const modulo = recursoConModulo.leccion.modulo;
        const allResources = modulo.lecciones.flatMap((l) => l.recursos);
        const resetGuids = allResources
          .filter((r) => {
            if (r.tipo === 'TAREA' && !r.titulo.startsWith('[QUIZ]')) return false;
            return true;
          })
          .map((r) => r.guid);

        const [, estudiante] = await Promise.all([
          // Delete progress records for the module's resources (non-task resources + quizzes)
          resetGuids.length > 0
            ? this.prisma.lms_progreso_recurso.deleteMany({
                where: { usuario_guid, recurso_guid: { in: resetGuids } },
              })
            : Promise.resolve(),
          this.prisma.usuarios.findUnique({
            where: { guid: usuario_guid },
            select: { nombre: true, apellido: true, email: true },
          }),
          // Delete old graded quiz attempts so the student's attempt counter resets.
          // Without this, startQuiz() still counts the old CALIFICADA attempts
          // and blocks the student from retrying when intentos_permitidos is reached.
          this.prisma.lms_entregas.deleteMany({
            where: {
              tarea_guid: recurso_guid,
              usuario_guid,
              estado: { in: ['CALIFICADA', 'ENTREGADA', 'ENTREGADA_TARDE'] },
            },
          }),
        ]);

        // Emit event instead of direct service calls
        this.eventEmitter.emit('quiz.failed', {
          usuario_guid,
          recurso_guid,
          nota,
          titulo_quiz: quizName,
          modulo_guid: modulo.guid,
          modulo_titulo: modulo.titulo,
          curso_titulo: modulo.curso.titulo,
          profesor_guid: modulo.curso.profesor_guid,
          estudiante,
        });
      }
    }

    return { success: true, nota, correctas, total };
  }

  async getQuizStatus(recurso_guid: string, usuario_guid: string) {
    const entregas = await this.prisma.lms_entregas.findMany({
      where: { tarea_guid: recurso_guid, usuario_guid },
    });

    let mejor_nota = 0;
    let inProgressAttempt: any = null;
    let validAttempts = 0;

    for (const e of entregas) {
      if (e.estado === 'BORRADOR') {
        inProgressAttempt = e;
      } else if (e.estado === 'CALIFICADA') {
        validAttempts++;
        if (e.calificacion != null) {
          const n = Number(e.calificacion);
          if (!isNaN(n) && n > mejor_nota) {
            mejor_nota = n;
          }
        }
      }
    }

    const progreso = await this.prisma.lms_progreso_recurso.findFirst({
      where: { usuario_guid, recurso_guid },
    });

    // Detect stale state: if there are graded attempts but no progress record,
    // the module was reset after a quiz failure. Treat attempt count as 0.
    const effectiveAttempts = validAttempts > 0 && !progreso ? 0 : validAttempts;
    const effectiveBestNota = validAttempts > 0 && !progreso ? 0 : mejor_nota;

    let maxIntentos = 0;
    try {
      const bloque = await this.prisma.lms_recursos.findUnique({
        where: { guid: recurso_guid },
        select: { quiz_config: true },
      });
      if (bloque?.quiz_config) {
        const config = JSON.parse(bloque.quiz_config);
        maxIntentos = config.intentos_permitidos || 0;
      }
    } catch {}

    const limitReached = maxIntentos > 0 && effectiveAttempts >= maxIntentos;

    return {
      intentos_realizados: effectiveAttempts,
      max_intentos: maxIntentos,
      mejor_nota: effectiveBestNota,
      completado: !!progreso,
      in_progress: !!inProgressAttempt,
      fecha_inicio: inProgressAttempt?.fecha_inicio,
      puede_reintentar: !progreso && !inProgressAttempt && !limitReached,
      limite_alcanzado: limitReached,
    };
  }

  async verificarMatricula(recurso_guid: string, usuario_guid: string): Promise<void> {
    const recurso = await this.prisma.lms_recursos.findUnique({
      where: { guid: recurso_guid },
      select: {
        leccion: {
          select: {
            modulo: {
              select: { curso_guid: true },
            },
          },
        },
      },
    });

    if (!recurso) {
      throw new BadRequestException('Recurso no encontrado.');
    }

    const curso_guid = recurso.leccion.modulo.curso_guid;

    const matricula = await this.prisma.lms_matriculas.findUnique({
      where: {
        usuario_guid_curso_guid: { usuario_guid, curso_guid },
      },
    });

    if (!matricula) {
      throw new BadRequestException('No estás matriculado en este curso.');
    }
  }
}
