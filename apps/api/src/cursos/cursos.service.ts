import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { lms_tipo_recurso, lms_estado_curso } from '@prisma/client';
import { LmsGateway } from '../ws/lms.gateway';

@Injectable()
export class CursosService {
  constructor(private prisma: PrismaService, private lmsGateway: LmsGateway) {}

  async getCursosActivosParaEstudiante() {
    return this.prisma.lms_cursos.findMany({
      where: { estado: 'PUBLICADO' },
      orderBy: { created_at: 'desc' }
    });
  }

  async getAllCursosParaAdmin() {
    return this.prisma.lms_cursos.findMany({
      orderBy: { created_at: 'desc' },
      take: 500
    });
  }

  async getProfesores() {
    return this.prisma.usuarios.findMany({
        where: { rol: 'PROFESOR' },
        select: { guid: true, nombre: true, apellido: true, email: true }
    });
  }

  async getEstudiantes() {
    return this.prisma.usuarios.findMany({
        where: { rol: 'ESTUDIANTE' },
        select: { guid: true, nombre: true, apellido: true, email: true }
    });
  }

  async asignarCurso(curso_guid: string, profesor_guid: string) {
    const updated = await this.prisma.lms_cursos.update({
        where: { guid: curso_guid },
        data: { profesor_guid }
    });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'course_assigned' });
    return updated;
  }

  async desasignarCurso(curso_guid: string, admin_guid: string) {
    const updated = await this.prisma.lms_cursos.update({
        where: { guid: curso_guid },
        data: { profesor_guid: admin_guid }
    });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'course_unassigned' });
    return updated;
  }

  async getCursosDeProfesor(profesor_guid: string) {
    return this.prisma.lms_cursos.findMany({
        where: { profesor_guid }, // El profesor DEBE ver sus cursos en borrador para editarlos
        orderBy: { created_at: 'desc' }
    });
  }

  async getCursosDeEstudiante(estudiante_guid: string) {
    const matriculas = await this.prisma.lms_matriculas.findMany({
      where: { usuario_guid: estudiante_guid },
      include: { curso: true },
      orderBy: { fecha_matricula: 'desc' }
    });
    return matriculas.map((m: any) => ({ ...m.curso, fecha_asignacion: m.fecha_matricula }));
  }

  async getCursosDeProfesorConFecha(profesor_guid: string) {
    return this.prisma.lms_cursos.findMany({
        where: { profesor_guid },
        orderBy: { updated_at: 'desc' },
        select: { guid: true, titulo: true, estado: true, created_at: true, updated_at: true }
    });
  }

  async getCursosDeEstudianteConFecha(estudiante_guid: string) {
    const matriculas = await this.prisma.lms_matriculas.findMany({
      where: { usuario_guid: estudiante_guid },
      include: { curso: { select: { guid: true, titulo: true, estado: true } } },
      orderBy: { fecha_matricula: 'desc' }
    });
    return matriculas.map((m: any) => ({ ...m.curso, fecha_asignacion: m.fecha_matricula }));
  }

  async getCursoDetalleCompleto(curso_guid: string) {
    const curso = await this.prisma.lms_cursos.findUnique({
      where: { guid: curso_guid },
      include: {
        modulos: {
          orderBy: { orden: 'asc' },
          include: {
            lecciones: {
              include: {
                recursos: {
                  orderBy: { orden: 'asc' }
                }
              }
            }
          }
        }
      }
    });

    if (!curso) throw new NotFoundException('Curso no encontrado');
    return curso;
  }

  async createCurso(data: { titulo: string; profesor_guid?: string }) {
    let guidFinal = data.profesor_guid;
    
    if (!guidFinal) {
        const fallBackAdmin = await this.prisma.usuarios.findFirst({
            where: { rol: { in: ['ADMINISTRADOR', 'PROFESOR'] } }
        });
        if (fallBackAdmin) guidFinal = fallBackAdmin.guid;
        else throw new BadRequestException('No hay profesores ni administradores disponibles para asignar el curso.');
    }

    const curso = await this.prisma.lms_cursos.create({
      data: {
        titulo: data.titulo,
        estado: 'BORRADOR',
        profesor_guid: guidFinal,
      }
    });

    this.lmsGateway.broadcast('course:created', { guid: curso.guid, titulo: curso.titulo });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'course_created' });
    return curso;
  }

  async updateCurso(curso_guid: string, data: { titulo?: string; estado?: string; imagen_portada?: string }, requestUser?: any) {
    // GUARD: If switching to BORRADOR, check for active quiz attempts
    if (data.estado === 'BORRADOR') {
      const curso = await this.prisma.lms_cursos.findUnique({ where: { guid: curso_guid } });
      if (curso && curso.estado === 'PUBLICADO') {
        // Get all quiz resources (TAREA with title starting with [QUIZ]) for this course
        const quizResources = await this.prisma.lms_recursos.findMany({
          where: {
            tipo: 'TAREA',
            titulo: { startsWith: '[QUIZ]' },
            leccion: {
              modulo: { curso_guid }
            }
          },
          select: { guid: true }
        });

        if (quizResources.length > 0) {
          const quizGuids = quizResources.map(r => r.guid);
          // Check for in-progress quiz attempts (estado = BORRADOR means quiz started but not submitted)
          const activeQuizAttempts = await this.prisma.lms_entregas.findMany({
            where: { tarea_guid: { in: quizGuids }, estado: 'BORRADOR' },
            select: { usuario_guid: true }
          });

          if (activeQuizAttempts.length > 0) {
            throw new BadRequestException(
              `No se puede pasar a Borrador: hay ${activeQuizAttempts.length} estudiante(s) realizando un quiz actualmente. Espera a que terminen.`
            );
          }
        }

        // No active quizzes — notify enrolled students about maintenance
        const matriculas = await this.prisma.lms_matriculas.findMany({
          where: { curso_guid },
          select: { usuario_guid: true }
        });
        const enrolledGuids = matriculas.map(m => m.usuario_guid);

        if (enrolledGuids.length > 0) {
          this.lmsGateway.broadcast('course:maintenance', {
            curso_guid,
            titulo: curso.titulo
          }, enrolledGuids);
        }

        // NOTE: course:editing lock is handled by the client-side WS mechanism
        // (course:lock / course:unlock). The lock is presence-based — only active
        // while the editor is physically inside the course editor page.
      }
    }

    // When publishing, release any editing lock (clears gateway Map + broadcasts)
    if (data.estado === 'PUBLICADO') {
      this.lmsGateway.releaseCourseEditor(curso_guid);
    }

    const updated = await this.prisma.lms_cursos.update({
        where: { guid: curso_guid },
        data: {
            ...(data.titulo !== undefined && { titulo: data.titulo }),
            ...(data.estado !== undefined && { estado: data.estado as lms_estado_curso }),
            ...(data.imagen_portada !== undefined && { imagen_portada: data.imagen_portada }),
        }
    });

    this.lmsGateway.broadcast('course:updated', { guid: curso_guid, ...data });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'course_updated' });
    return updated;
  }

  /** Helper: ensures the course is in BORRADOR before allowing mutations */
  private async ensureDraft(curso_guid: string): Promise<void> {
    const curso = await this.prisma.lms_cursos.findUnique({ where: { guid: curso_guid }, select: { estado: true } });
    if (!curso) throw new NotFoundException('Curso no encontrado');
    if (curso.estado !== 'BORRADOR') {
      throw new BadRequestException('El curso debe estar en estado Borrador para realizar cambios.');
    }
  }

  /** Helper: gets the curso_guid from a resource guid */
  private async getCursoGuidFromRecurso(recurso_guid: string): Promise<string> {
    const recurso = await this.prisma.lms_recursos.findUnique({
      where: { guid: recurso_guid },
      select: { leccion: { select: { modulo: { select: { curso_guid: true } } } } }
    });
    if (!recurso) throw new NotFoundException('Recurso no encontrado');
    return recurso.leccion.modulo.curso_guid;
  }

  async createModuloParaCurso(curso_guid: string, data: { titulo: string; orden?: number }) {
    const curso = await this.prisma.lms_cursos.findUnique({ where: { guid: curso_guid } });
    if (!curso) throw new NotFoundException('Curso no encontrado');
    await this.ensureDraft(curso_guid);

    const orden = data.orden ?? await this.prisma.lms_modulos.count({ where: { curso_guid } });

    return this.prisma.$transaction(async (tx) => {
        const modulo = await tx.lms_modulos.create({
            data: { curso_guid, titulo: data.titulo, orden }
        });

        await tx.lms_lecciones.create({
            data: { modulo_guid: modulo.guid, titulo: 'Lección Interna Módulo ' + modulo.guid, orden: 0 }
        });

        return modulo;
    });
  }

  async updateModulo(modulo_guid: string, data: { titulo: string }) {
    const modulo = await this.prisma.lms_modulos.findUnique({ where: { guid: modulo_guid }, select: { curso_guid: true } });
    if (!modulo) throw new NotFoundException('Módulo no encontrado');
    await this.ensureDraft(modulo.curso_guid);
    return this.prisma.lms_modulos.update({
        where: { guid: modulo_guid },
        data: { titulo: data.titulo }
    });
  }

  async getBloque(guid: string) {
    const bloque = await this.prisma.lms_recursos.findUnique({
        where: { guid }
    });
    if (!bloque) throw new NotFoundException('Recurso no encontrado');
    return bloque;
  }

  async addBloqueToModulo(modulo_guid: string, data: { tipo: lms_tipo_recurso; contenido_html?: string; titulo?: string }) {
    const modulo = await this.prisma.lms_modulos.findUnique({
        where: { guid: modulo_guid },
        include: { lecciones: true }
    });

    if (!modulo) throw new NotFoundException('Módulo no encontrado');
    await this.ensureDraft(modulo.curso_guid);
    if (!modulo.lecciones || modulo.lecciones.length === 0) {
        throw new BadRequestException('Módulo corrupto sin lección interna base.');
    }

    const leccion_guid = modulo.lecciones[0].guid;
    const count = await this.prisma.lms_recursos.count({ where: { leccion_guid } });

    return this.prisma.lms_recursos.create({
        data: {
            leccion_guid,
            titulo: data.titulo || 'Bloque',
            tipo: data.tipo,
            contenido_html: data.contenido_html,
            orden: count,
            obligatorio: true
        }
    });
  }

  async updateBloque(guid: string, data: { titulo?: string; contenido_html?: string; url_archivo?: string; url_referencia?: string; archivo_adjunto?: string; archivo_adjunto_nombre?: string; quiz_config?: string; archivo_max_size_mb?: number }) {
    const cursoGuid = await this.getCursoGuidFromRecurso(guid);
    await this.ensureDraft(cursoGuid);
    return this.prisma.lms_recursos.update({
        where: { guid },
        data: {
            titulo: data.titulo,
            contenido_html: data.contenido_html,
            url_archivo: data.url_archivo,
            url_referencia: data.url_referencia,
            archivo_adjunto: data.archivo_adjunto,
            archivo_adjunto_nombre: data.archivo_adjunto_nombre,
            quiz_config: data.quiz_config,
            archivo_max_size_mb: data.archivo_max_size_mb,
        }
    });
  }

  async deleteBloque(guid: string) {
    const cursoGuid = await this.getCursoGuidFromRecurso(guid);
    await this.ensureDraft(cursoGuid);
    return this.prisma.lms_recursos.delete({ where: { guid } });
  }

  async reorderBloques(modulo_guid: string, recursos_guids: string[]) {
    // Validar que el módulo existe y obtener su lección principal
    const modulo = await this.prisma.lms_modulos.findUnique({
      where: { guid: modulo_guid },
      include: { lecciones: true }
    });
    if (!modulo || !modulo.lecciones || modulo.lecciones.length === 0) {
      throw new NotFoundException('Módulo o lección no encontrada.');
    }
    await this.ensureDraft(modulo.curso_guid);
    
    // Ejecutar transacciones en secuencia para actualizar el campo orden de cada recurso
    const queries = recursos_guids.map((guid, index) => {
      return this.prisma.lms_recursos.update({
        where: { guid },
        data: { orden: index }
      });
    });

    return this.prisma.$transaction(queries);
  }

  async deleteModulo(guid: string) {
    const modulo = await this.prisma.lms_modulos.findUnique({ where: { guid }, select: { curso_guid: true } });
    if (!modulo) throw new NotFoundException('Módulo no encontrado');
    await this.ensureDraft(modulo.curso_guid);
    return this.prisma.lms_modulos.delete({ where: { guid } });
  }

  async deleteCurso(guid: string) {
    await this.ensureDraft(guid);
    const result = await this.prisma.lms_cursos.delete({ where: { guid } });
    this.lmsGateway.broadcast('course:deleted', { guid });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'course_deleted' });
    return result;
  }

  async startQuiz(recurso_guid: string, usuario_guid: string) {
    const bloque = await this.prisma.lms_recursos.findUnique({ where: { guid: recurso_guid } });
    if (!bloque || bloque.tipo !== 'TAREA' || !bloque.quiz_config) {
      throw new BadRequestException('El recurso no es un cuestionario válido.');
    }

    const enProgreso = await this.prisma.lms_entregas.findFirst({
        where: { tarea_guid: recurso_guid, usuario_guid, estado: 'BORRADOR' }
    });
    if (enProgreso) return { success: true, guid: enProgreso.guid, fecha_inicio: enProgreso.fecha_inicio };

    const prevAttempts = await this.prisma.lms_entregas.count({
        where: { tarea_guid: recurso_guid, usuario_guid, estado: { in: ['CALIFICADA', 'ENTREGADA', 'ENTREGADA_TARDE'] } }
    });

    const nueva = await this.prisma.lms_entregas.create({
        data: {
            usuario_guid,
            tarea_guid: recurso_guid,
            estado: 'BORRADOR',
            fecha_inicio: new Date(),
            intento_numero: prevAttempts + 1
        }
    });

    return { success: true, guid: nueva.guid, fecha_inicio: nueva.fecha_inicio };
  }

  async evaluarQuiz(recurso_guid: string, usuario_guid: string, respuestas: Record<string, string>) {
    const bloque = await this.prisma.lms_recursos.findUnique({ where: { guid: recurso_guid } });
    if (!bloque || bloque.tipo !== 'TAREA' || !bloque.quiz_config) {
      throw new BadRequestException('El recurso no es un cuestionario válido.');
    }

    let quizConfig: any;
    try { quizConfig = JSON.parse(bloque.quiz_config); } catch {
      throw new BadRequestException('Configuración de cuestionario corrupta.');
    }

    const preguntas = quizConfig.preguntas || [];
    let correctas = 0;
    const total = preguntas.length;

    for (const p of preguntas) {
      const userAnswer = respuestas[p.id];
      const correctOption = p.opciones.find((o: any) => o.es_correcta);
      if (correctOption && userAnswer === correctOption.id) {
        correctas++;
      }
    }

    let nota = 0;
    if (total > 0) {
      nota = parseFloat(((correctas / total) * 5).toFixed(1));
    }

    const enProgreso = await this.prisma.lms_entregas.findFirst({
        where: { tarea_guid: recurso_guid, usuario_guid, estado: 'BORRADOR' }
    });

    if (enProgreso) {
        await this.prisma.lms_entregas.update({
            where: { guid: enProgreso.guid },
            data: {
                estado: 'CALIFICADA',
                fecha_entrega: new Date(),
                contenido_texto: `NOTA: ${nota.toFixed(1)} | ${correctas}/${total} correctas`,
            }
        });
    } else {
        await this.prisma.lms_entregas.create({
            data: {
                usuario_guid,
                tarea_guid: recurso_guid,
                estado: 'CALIFICADA',
                fecha_inicio: new Date(),
                fecha_entrega: new Date(),
                contenido_texto: `NOTA: ${nota.toFixed(1)} | ${correctas}/${total} correctas`,
            }
        });
    }

    if (nota >= 3.0) {
        const existente = await this.prisma.lms_progreso_recurso.findFirst({
            where: { usuario_guid, recurso_guid }
        });
        if (!existente) {
            await this.prisma.lms_progreso_recurso.create({
                data: { usuario_guid, recurso_guid }
            });
        }
    }

    return { success: true, nota, correctas, total };
  }

  async getQuizStatus(recurso_guid: string, usuario_guid: string) {
    const entregas = await this.prisma.lms_entregas.findMany({
      where: { tarea_guid: recurso_guid, usuario_guid }
    });
    
    let mejor_nota = 0;
    let inProgressAttempt: any = null;
    let validAttempts = 0;

    for (const e of entregas) {
      if (e.estado === 'BORRADOR') {
          inProgressAttempt = e;
      } else if (e.estado === 'CALIFICADA' || e.contenido_texto?.startsWith('NOTA: ')) {
          validAttempts++;
          if (e.contenido_texto) {
              const notaStr = e.contenido_texto.replace('NOTA: ', '').split(' | ')[0];
              const n = parseFloat(notaStr);
              if (!isNaN(n) && n > mejor_nota) {
                mejor_nota = n;
              }
          }
      }
    }
    
    const progreso = await this.prisma.lms_progreso_recurso.findFirst({
        where: { usuario_guid, recurso_guid }
    });

    return {
      intentos_realizados: validAttempts,
      mejor_nota,
      completado: !!progreso,
      in_progress: !!inProgressAttempt,
      fecha_inicio: inProgressAttempt?.fecha_inicio
    };
  }
}
