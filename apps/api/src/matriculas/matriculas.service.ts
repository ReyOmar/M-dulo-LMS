import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { lms_tipo_matricula } from '@prisma/client';
import { LmsGateway } from '../ws/lms.gateway';
import { MailService } from '../mail/mail.service';

@Injectable()
export class MatriculasService {
  private readonly logger = new Logger(MatriculasService.name);
  constructor(
    private prisma: PrismaService,
    private lmsGateway: LmsGateway,
    private mailService: MailService,
  ) {}

  async matricularEstudiante(curso_guid: string, usuario_guid: string) {
    const existing = await this.prisma.lms_matriculas.findUnique({
      where: { usuario_guid_curso_guid: { usuario_guid, curso_guid } },
    });
    if (existing) return existing;

    const result = await this.prisma.lms_matriculas.create({
      data: { usuario_guid, curso_guid, tipo: 'MANUAL' as lms_tipo_matricula },
    });

    this.lmsGateway.broadcast('enrollment:changed', { action: 'enrolled', curso_guid, usuario_guid }, [usuario_guid]);
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'enrollment_changed' }, [usuario_guid]);
    this.lmsGateway.broadcastToRole('dashboard:refresh', { reason: 'enrollment_changed' }, 'ADMINISTRADOR');

    // Fire-and-forget: Send enrollment email notification
    (async () => {
      try {
        const [student, course] = await Promise.all([
          this.prisma.usuarios.findUnique({ where: { guid: usuario_guid }, select: { email: true, nombre: true } }),
          this.prisma.lms_cursos.findUnique({ where: { guid: curso_guid }, select: { titulo: true } }),
        ]);
        if (student && course) {
          this.mailService
            .sendEnrollmentNotification(student.email, student.nombre, course.titulo, curso_guid)
            .catch(() => {});
        }
      } catch (err) {
        this.logger.error('Enrollment email error:', err);
      }
    })();

    return result;
  }

  async desmatricularEstudiante(curso_guid: string, usuario_guid: string) {
    const result = await this.prisma.lms_matriculas.delete({
      where: { usuario_guid_curso_guid: { usuario_guid, curso_guid } },
    });

    this.lmsGateway.broadcast('enrollment:changed', { action: 'unenrolled', curso_guid, usuario_guid }, [usuario_guid]);
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'enrollment_changed' }, [usuario_guid]);
    this.lmsGateway.broadcastToRole('dashboard:refresh', { reason: 'enrollment_changed' }, 'ADMINISTRADOR');

    return result;
  }

  async getMatriculasCurso(curso_guid: string) {
    return this.prisma.lms_matriculas.findMany({
      where: { curso_guid },
      include: {
        usuario: { select: { guid: true, nombre: true, apellido: true, email: true } },
      },
      take: 1000,
    });
  }

  async getEstudiantesDisponibles() {
    return this.prisma.usuarios.findMany({
      where: { rol: 'ESTUDIANTE' },
      select: { guid: true, nombre: true, apellido: true, email: true },
    });
  }

  async seedMatriculas() {
    // COD-07: Guard against accidental execution in production
    if (process.env.NODE_ENV === 'production') {
      throw new Error('seedMatriculas no está disponible en producción.');
    }

    const estudiantes = await this.prisma.usuarios.findMany({ where: { rol: 'ESTUDIANTE' } });
    const cursos = await this.prisma.lms_cursos.findMany({ where: { estado: 'PUBLICADO' } });

    let count = 0;
    for (const est of estudiantes) {
      for (const curso of cursos) {
        const existing = await this.prisma.lms_matriculas.findUnique({
          where: { usuario_guid_curso_guid: { usuario_guid: est.guid, curso_guid: curso.guid } },
        });
        if (!existing) {
          await this.prisma.lms_matriculas.create({
            data: { usuario_guid: est.guid, curso_guid: curso.guid, tipo: 'MANUAL' as lms_tipo_matricula },
          });
          count++;
        }
      }
    }
    return { matriculas_creadas: count };
  }
}
