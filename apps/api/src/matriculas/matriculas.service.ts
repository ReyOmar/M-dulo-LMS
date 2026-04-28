import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { lms_tipo_matricula } from '@prisma/client';

@Injectable()
export class MatriculasService {
  constructor(private prisma: PrismaService) {}

  async matricularEstudiante(curso_guid: string, usuario_guid: string) {
    const existing = await this.prisma.lms_matriculas.findUnique({
      where: { usuario_guid_curso_guid: { usuario_guid, curso_guid } }
    });
    if (existing) return existing;

    return this.prisma.lms_matriculas.create({
      data: { usuario_guid, curso_guid, tipo: 'MANUAL' as lms_tipo_matricula }
    });
  }

  async desmatricularEstudiante(curso_guid: string, usuario_guid: string) {
    return this.prisma.lms_matriculas.delete({
      where: { usuario_guid_curso_guid: { usuario_guid, curso_guid } }
    });
  }

  async getMatriculasCurso(curso_guid: string) {
    return this.prisma.lms_matriculas.findMany({
      where: { curso_guid },
      include: {
        usuario: { select: { guid: true, nombre: true, apellido: true, email: true } }
      },
      take: 1000
    });
  }

  async getEstudiantesDisponibles() {
    return this.prisma.usuarios.findMany({
      where: { rol: 'ESTUDIANTE' },
      select: { guid: true, nombre: true, apellido: true, email: true }
    });
  }

  async seedMatriculas() {
    const estudiantes = await this.prisma.usuarios.findMany({ where: { rol: 'ESTUDIANTE' } });
    const cursos = await this.prisma.lms_cursos.findMany({ where: { estado: 'PUBLICADO' } });

    let count = 0;
    for (const est of estudiantes) {
      for (const curso of cursos) {
        const existing = await this.prisma.lms_matriculas.findUnique({
          where: { usuario_guid_curso_guid: { usuario_guid: est.guid, curso_guid: curso.guid } }
        });
        if (!existing) {
          await this.prisma.lms_matriculas.create({
            data: { usuario_guid: est.guid, curso_guid: curso.guid, tipo: 'MANUAL' as lms_tipo_matricula }
          });
          count++;
        }
      }
    }
    return { matriculas_creadas: count };
  }
}
