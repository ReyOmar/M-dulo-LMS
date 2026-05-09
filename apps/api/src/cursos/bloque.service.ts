import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { lms_tipo_recurso } from '@prisma/client';

/**
 * BloqueService — Manages course content blocks (recursos) and modules.
 * Extracted from CursosService to follow Single Responsibility Principle.
 */
@Injectable()
export class BloqueService {
  constructor(private prisma: PrismaService) {}

  /** Helper: ensures the course is in BORRADOR before allowing mutations */
  async ensureDraft(curso_guid: string): Promise<void> {
    const curso = await this.prisma.lms_cursos.findUnique({ where: { guid: curso_guid }, select: { estado: true } });
    if (!curso) throw new NotFoundException('Curso no encontrado');
    if (curso.estado !== 'BORRADOR') {
      throw new BadRequestException('El curso debe estar en estado Borrador para realizar cambios.');
    }
  }

  /** Helper: ensures PROFESOR owns the course (admin bypasses) */
  async ensureOwnership(curso_guid: string, requestUser?: any): Promise<void> {
    if (!requestUser || requestUser.role !== 'PROFESOR') return; // Admin bypass
    const curso = await this.prisma.lms_cursos.findUnique({
      where: { guid: curso_guid },
      select: { profesor_guid: true }
    });
    if (!curso) throw new NotFoundException('Curso no encontrado');
    if (curso.profesor_guid !== requestUser.sub) {
      throw new BadRequestException('Solo puedes modificar cursos asignados a ti.');
    }
  }

  /** Helper: gets the curso_guid from a resource guid */
  async getCursoGuidFromRecurso(recurso_guid: string): Promise<string> {
    const recurso = await this.prisma.lms_recursos.findUnique({
      where: { guid: recurso_guid },
      select: { leccion: { select: { modulo: { select: { curso_guid: true } } } } }
    });
    if (!recurso) throw new NotFoundException('Recurso no encontrado');
    return recurso.leccion.modulo.curso_guid;
  }

  async createModuloParaCurso(curso_guid: string, data: { titulo: string; orden?: number }, requestUser?: any) {
    const curso = await this.prisma.lms_cursos.findUnique({ where: { guid: curso_guid } });
    if (!curso) throw new NotFoundException('Curso no encontrado');
    await this.ensureOwnership(curso_guid, requestUser);
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

  async updateModulo(modulo_guid: string, data: { titulo: string }, requestUser?: any) {
    const modulo = await this.prisma.lms_modulos.findUnique({ where: { guid: modulo_guid }, select: { curso_guid: true } });
    if (!modulo) throw new NotFoundException('Módulo no encontrado');
    await this.ensureOwnership(modulo.curso_guid, requestUser);
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

  async addBloqueToModulo(modulo_guid: string, data: { tipo: lms_tipo_recurso; contenido_html?: string; titulo?: string }, requestUser?: any) {
    const modulo = await this.prisma.lms_modulos.findUnique({
        where: { guid: modulo_guid },
        include: { lecciones: true }
    });

    if (!modulo) throw new NotFoundException('Módulo no encontrado');
    await this.ensureOwnership(modulo.curso_guid, requestUser);
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

  async updateBloque(guid: string, data: { titulo?: string; contenido_html?: string; url_archivo?: string; url_referencia?: string; archivo_adjunto?: string; archivo_adjunto_nombre?: string; quiz_config?: string; archivo_max_size_mb?: number }, requestUser?: any) {
    const cursoGuid = await this.getCursoGuidFromRecurso(guid);
    await this.ensureOwnership(cursoGuid, requestUser);
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

  async deleteBloque(guid: string, requestUser?: any) {
    const cursoGuid = await this.getCursoGuidFromRecurso(guid);
    await this.ensureOwnership(cursoGuid, requestUser);
    await this.ensureDraft(cursoGuid);
    return this.prisma.lms_recursos.delete({ where: { guid } });
  }

  async reorderBloques(modulo_guid: string, recursos_guids: string[], requestUser?: any) {
    const modulo = await this.prisma.lms_modulos.findUnique({
      where: { guid: modulo_guid },
      include: { lecciones: true }
    });
    if (!modulo || !modulo.lecciones || modulo.lecciones.length === 0) {
      throw new NotFoundException('Módulo o lección no encontrada.');
    }
    await this.ensureOwnership(modulo.curso_guid, requestUser);
    await this.ensureDraft(modulo.curso_guid);
    
    const queries = recursos_guids.map((guid, index) => {
      return this.prisma.lms_recursos.update({
        where: { guid },
        data: { orden: index }
      });
    });

    return this.prisma.$transaction(queries);
  }

  async deleteModulo(guid: string, requestUser?: any) {
    const modulo = await this.prisma.lms_modulos.findUnique({ where: { guid }, select: { curso_guid: true } });
    if (!modulo) throw new NotFoundException('Módulo no encontrado');
    await this.ensureOwnership(modulo.curso_guid, requestUser);
    await this.ensureDraft(modulo.curso_guid);
    return this.prisma.lms_modulos.delete({ where: { guid } });
  }
}
