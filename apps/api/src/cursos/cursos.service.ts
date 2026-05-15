import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { lms_estado_curso } from '@prisma/client';
import { LmsGateway } from '../ws/lms.gateway';
import { StorageService } from '../storage/storage.service';
import { MailService } from '../mail/mail.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

/**
 * CursosService — Core course management (CRUD, assignment, listing).
 * Module/block management is delegated to BloqueService.
 * Quiz logic is delegated to QuizService.
 */
@Injectable()
export class CursosService {
  private readonly logger = new Logger(CursosService.name);
  constructor(
    private prisma: PrismaService,
    private lmsGateway: LmsGateway,
    private storageService: StorageService,
    private mailService: MailService,
  ) {}

  /**
   * F3.4: Verify a user has access to a specific course.
   * - ESTUDIANTE: must be enrolled (lms_matriculas)
   * - PROFESOR: must be the course's assigned professor
   * @throws NotFoundException if access is denied (avoids revealing course existence)
   */
  async verificarAccesoCurso(curso_guid: string, usuario_guid: string, role: string): Promise<void> {
    const curso = await this.prisma.lms_cursos.findUnique({
      where: { guid: curso_guid },
      select: { profesor_guid: true },
    });
    if (!curso) throw new NotFoundException('Curso no encontrado.');

    if (role === 'PROFESOR') {
      if (curso.profesor_guid !== usuario_guid) {
        throw new NotFoundException('Curso no encontrado.');
      }
    } else {
      // ESTUDIANTE — must be enrolled
      const matricula = await this.prisma.lms_matriculas.findUnique({
        where: { usuario_guid_curso_guid: { usuario_guid, curso_guid } },
      });
      if (!matricula) {
        throw new NotFoundException('Curso no encontrado.');
      }
    }
  }

  async getCursosActivosParaEstudiante() {
    return this.prisma.lms_cursos.findMany({
      where: { estado: 'PUBLICADO' },
      orderBy: { created_at: 'desc' },
    });
  }

  async getAllCursosParaAdmin() {
    return this.prisma.lms_cursos.findMany({
      orderBy: { created_at: 'desc' },
      take: 500,
    });
  }

  async getProfesores() {
    return this.prisma.usuarios.findMany({
      where: { rol: 'PROFESOR' },
      select: { guid: true, nombre: true, apellido: true, email: true },
    });
  }

  async getEstudiantes() {
    return this.prisma.usuarios.findMany({
      where: { rol: 'ESTUDIANTE' },
      select: { guid: true, nombre: true, apellido: true, email: true },
    });
  }

  async asignarCurso(curso_guid: string, profesor_guid: string) {
    const updated = await this.prisma.lms_cursos.update({
      where: { guid: curso_guid },
      data: { profesor_guid },
    });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'course_assigned' });
    return updated;
  }

  async desasignarCurso(curso_guid: string, admin_guid: string) {
    const updated = await this.prisma.lms_cursos.update({
      where: { guid: curso_guid },
      data: { profesor_guid: admin_guid },
    });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'course_unassigned' });
    return updated;
  }

  async getCursosDeProfesor(profesor_guid: string) {
    return this.prisma.lms_cursos.findMany({
      where: { profesor_guid },
      orderBy: { created_at: 'desc' },
    });
  }

  async getCursosDeEstudiante(estudiante_guid: string) {
    const matriculas = await this.prisma.lms_matriculas.findMany({
      where: { usuario_guid: estudiante_guid },
      include: { curso: true },
      orderBy: { fecha_matricula: 'desc' },
    });
    return matriculas.map((m: any) => ({ ...m.curso, fecha_asignacion: m.fecha_matricula }));
  }

  async getCursosDeProfesorConFecha(profesor_guid: string) {
    return this.prisma.lms_cursos.findMany({
      where: { profesor_guid },
      orderBy: { updated_at: 'desc' },
      select: { guid: true, titulo: true, estado: true, created_at: true, updated_at: true },
    });
  }

  async getCursosDeEstudianteConFecha(estudiante_guid: string) {
    const matriculas = await this.prisma.lms_matriculas.findMany({
      where: { usuario_guid: estudiante_guid },
      include: { curso: { select: { guid: true, titulo: true, estado: true } } },
      orderBy: { fecha_matricula: 'desc' },
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
              orderBy: { orden: 'asc' },
              include: {
                recursos: {
                  orderBy: { orden: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!curso) throw new NotFoundException('Curso no encontrado');
    return curso;
  }

  async createCurso(data: { titulo: string; profesor_guid?: string }) {
    let guidFinal = data.profesor_guid;

    if (!guidFinal) {
      const fallBackAdmin = await this.prisma.usuarios.findFirst({
        where: { rol: { in: ['ADMINISTRADOR', 'PROFESOR'] } },
      });
      if (fallBackAdmin) guidFinal = fallBackAdmin.guid;
      else throw new BadRequestException('No hay profesores ni administradores disponibles para asignar el curso.');
    }

    const curso = await this.prisma.lms_cursos.create({
      data: {
        titulo: data.titulo,
        estado: 'BORRADOR',
        profesor_guid: guidFinal,
      },
    });

    this.lmsGateway.broadcast('course:created', { guid: curso.guid, titulo: curso.titulo });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'course_created' });
    return curso;
  }

  async updateCurso(
    curso_guid: string,
    data: { titulo?: string; estado?: string; imagen_portada?: string },
    requestUser?: JwtPayload,
  ) {
    // GUARD: Professors can only edit their own assigned courses
    if (requestUser?.role === 'PROFESOR') {
      const cursoOwnership = await this.prisma.lms_cursos.findUnique({
        where: { guid: curso_guid },
        select: { profesor_guid: true },
      });
      if (!cursoOwnership) throw new NotFoundException('Curso no encontrado');
      if (cursoOwnership.profesor_guid !== requestUser.sub) {
        throw new BadRequestException('Solo puedes editar cursos asignados a ti.');
      }
    }

    // GUARD: If switching to BORRADOR, check for active quiz attempts
    if (data.estado === 'BORRADOR') {
      const curso = await this.prisma.lms_cursos.findUnique({ where: { guid: curso_guid } });
      if (curso && curso.estado === 'PUBLICADO') {
        const quizResources = await this.prisma.lms_recursos.findMany({
          where: {
            tipo: 'TAREA',
            titulo: { startsWith: '[QUIZ]' },
            leccion: { modulo: { curso_guid } },
          },
          select: { guid: true },
        });

        if (quizResources.length > 0) {
          const quizGuids = quizResources.map((r) => r.guid);
          const activeQuizAttempts = await this.prisma.lms_entregas.findMany({
            where: { tarea_guid: { in: quizGuids }, estado: 'BORRADOR' },
            select: { usuario_guid: true },
          });

          if (activeQuizAttempts.length > 0) {
            throw new BadRequestException(
              `No se puede pasar a Borrador: hay ${activeQuizAttempts.length} estudiante(s) realizando un quiz actualmente. Espera a que terminen.`,
            );
          }
        }

        const matriculas = await this.prisma.lms_matriculas.findMany({
          where: { curso_guid },
          select: { usuario_guid: true },
        });
        const enrolledGuids = matriculas.map((m) => m.usuario_guid);

        if (enrolledGuids.length > 0) {
          this.lmsGateway.broadcast(
            'course:maintenance',
            {
              curso_guid,
              titulo: curso.titulo,
            },
            enrolledGuids,
          );

          // Fire-and-forget: Send maintenance email to all enrolled students
          (async () => {
            try {
              const students = await this.prisma.usuarios.findMany({
                where: { guid: { in: enrolledGuids } },
                select: { email: true, nombre: true },
              });
              for (const s of students) {
                this.mailService.sendCourseMaintenanceNotification(s.email, s.nombre, curso.titulo).catch(() => {});
              }
            } catch (err) {
              this.logger.error('Course maintenance email error:', err);
            }
          })();
        }
      }
    }

    if (data.estado === 'PUBLICADO') {
      this.lmsGateway.releaseCourseEditor(curso_guid);
    }

    const updated = await this.prisma.lms_cursos.update({
      where: { guid: curso_guid },
      data: {
        ...(data.titulo !== undefined && { titulo: data.titulo }),
        ...(data.estado !== undefined && { estado: data.estado as lms_estado_curso }),
        ...(data.imagen_portada !== undefined && { imagen_portada: data.imagen_portada }),
      },
    });

    this.lmsGateway.broadcast('course:updated', { guid: curso_guid, ...data });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'course_updated' });
    return updated;
  }

  async deleteCurso(guid: string) {
    // Verify draft status
    const curso = await this.prisma.lms_cursos.findUnique({ where: { guid }, select: { estado: true } });
    if (!curso) throw new NotFoundException('Curso no encontrado');
    if (curso.estado !== 'BORRADOR') {
      throw new BadRequestException('El curso debe estar en estado Borrador para realizar cambios.');
    }

    // Clean up associated certificate PDFs from R2 before cascade delete
    const certs = await this.prisma.lms_certificados.findMany({
      where: { curso_guid: guid },
      select: { archivo_pdf: true },
    });
    for (const cert of certs) {
      if (cert.archivo_pdf) {
        try {
          await this.storageService.deleteFile(cert.archivo_pdf);
          this.logger.log(`Deleted certificate file: ${cert.archivo_pdf}`);
        } catch (err) {
          this.logger.warn(`Failed to delete certificate file ${cert.archivo_pdf}: ${(err as Error)?.message || err}`);
        }
      }
    }

    const result = await this.prisma.lms_cursos.delete({ where: { guid } });
    this.lmsGateway.broadcast('course:deleted', { guid });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'course_deleted' });
    if (certs.length > 0) {
      this.logger.log(`Cleaned up ${certs.length} certificate(s) from R2 for course ${guid}`);
    }
    return result;
  }
}
