import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { lms_tipo_recurso } from '@prisma/client';

/**
 * BloqueService — Manages course content blocks (recursos) and modules.
 * Extracted from CursosService to follow Single Responsibility Principle.
 *
 * Performance: Validation helpers use combined queries to minimize round-trips.
 */
@Injectable()
export class BloqueService {
  constructor(private prisma: PrismaService) {}

  /**
   * Combined validation: checks course exists, is BORRADOR, and ownership in ONE query.
   * Replaces the old 3-query pattern (ensureDraft + ensureOwnership + find).
   */
  private assertDraftAndOwnership(curso: { estado: string; profesor_guid: string } | null, requestUser?: any): void {
    if (!curso) throw new NotFoundException('Curso no encontrado');
    if (curso.estado !== 'BORRADOR') {
      throw new BadRequestException('El curso debe estar en estado Borrador para realizar cambios.');
    }
    if (requestUser?.role === 'PROFESOR' && curso.profesor_guid !== requestUser.sub) {
      throw new BadRequestException('Solo puedes modificar cursos asignados a ti.');
    }
  }

  async createModuloParaCurso(curso_guid: string, data: { titulo: string; orden?: number }, requestUser?: any) {
    // Single query: fetch course + validate
    const curso = await this.prisma.lms_cursos.findUnique({
      where: { guid: curso_guid },
      select: { estado: true, profesor_guid: true },
    });
    this.assertDraftAndOwnership(curso, requestUser);

    const orden = data.orden ?? (await this.prisma.lms_modulos.count({ where: { curso_guid } }));

    return this.prisma.$transaction(async (tx) => {
      const modulo = await tx.lms_modulos.create({
        data: { curso_guid, titulo: data.titulo, orden },
      });

      await tx.lms_lecciones.create({
        data: { modulo_guid: modulo.guid, titulo: 'Lección Interna Módulo ' + modulo.guid, orden: 0 },
      });

      return modulo;
    });
  }

  async updateModulo(modulo_guid: string, data: { titulo: string }, requestUser?: any) {
    // Single query: fetch module + course state + ownership
    const modulo = await this.prisma.lms_modulos.findUnique({
      where: { guid: modulo_guid },
      select: { curso_guid: true, curso: { select: { estado: true, profesor_guid: true } } },
    });
    if (!modulo) throw new NotFoundException('Módulo no encontrado');
    this.assertDraftAndOwnership(modulo.curso, requestUser);

    return this.prisma.lms_modulos.update({
      where: { guid: modulo_guid },
      data: { titulo: data.titulo },
    });
  }

  async getBloque(guid: string) {
    const bloque = await this.prisma.lms_recursos.findUnique({
      where: { guid },
    });
    if (!bloque) throw new NotFoundException('Recurso no encontrado');
    return bloque;
  }

  async addBloqueToModulo(
    modulo_guid: string,
    data: { tipo: lms_tipo_recurso; contenido_html?: string; titulo?: string },
    requestUser?: any,
  ) {
    // Single query: fetch module + lessons + course validation data
    const modulo = await this.prisma.lms_modulos.findUnique({
      where: { guid: modulo_guid },
      include: {
        lecciones: { select: { guid: true }, take: 1, orderBy: { orden: 'asc' } },
        curso: { select: { estado: true, profesor_guid: true } },
      },
    });

    if (!modulo) throw new NotFoundException('Módulo no encontrado');
    this.assertDraftAndOwnership(modulo.curso, requestUser);

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
        obligatorio: true,
      },
    });
  }

  async updateBloque(
    guid: string,
    data: {
      titulo?: string;
      contenido_html?: string;
      url_archivo?: string;
      url_referencia?: string;
      archivo_adjunto?: string;
      archivo_adjunto_nombre?: string;
      quiz_config?: string;
      archivo_max_size_mb?: number;
    },
    requestUser?: any,
  ) {
    // Single query: fetch resource + course state via joins
    const recurso = await this.prisma.lms_recursos.findUnique({
      where: { guid },
      select: {
        guid: true,
        leccion: { select: { modulo: { select: { curso: { select: { estado: true, profesor_guid: true } } } } } },
      },
    });
    if (!recurso) throw new NotFoundException('Recurso no encontrado');
    this.assertDraftAndOwnership(recurso.leccion.modulo.curso, requestUser);

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
      },
    });
  }

  async deleteBloque(guid: string, requestUser?: any) {
    // Single query: fetch resource + course state via joins
    const recurso = await this.prisma.lms_recursos.findUnique({
      where: { guid },
      select: {
        guid: true,
        leccion: { select: { modulo: { select: { curso: { select: { estado: true, profesor_guid: true } } } } } },
      },
    });
    if (!recurso) throw new NotFoundException('Recurso no encontrado');
    this.assertDraftAndOwnership(recurso.leccion.modulo.curso, requestUser);

    return this.prisma.lms_recursos.delete({ where: { guid } });
  }

  async reorderBloques(modulo_guid: string, recursos_guids: string[], requestUser?: any) {
    // Single query: module + course validation
    const modulo = await this.prisma.lms_modulos.findUnique({
      where: { guid: modulo_guid },
      select: {
        curso_guid: true,
        curso: { select: { estado: true, profesor_guid: true } },
        lecciones: { select: { guid: true }, take: 1 },
      },
    });
    if (!modulo || !modulo.lecciones || modulo.lecciones.length === 0) {
      throw new NotFoundException('Módulo o lección no encontrada.');
    }
    this.assertDraftAndOwnership(modulo.curso, requestUser);

    // F2.1/F2.2: Validate that ALL provided GUIDs belong to this module's lesson
    const leccionGuid = modulo.lecciones[0].guid;
    const validResources = await this.prisma.lms_recursos.findMany({
      where: { leccion_guid: leccionGuid },
      select: { guid: true },
    });
    const validGuids = new Set(validResources.map((r) => r.guid));
    const invalidGuids = recursos_guids.filter((guid) => !validGuids.has(guid));
    if (invalidGuids.length > 0) {
      throw new BadRequestException(`Los siguientes recursos no pertenecen a este módulo: ${invalidGuids.join(', ')}`);
    }

    const queries = recursos_guids.map((guid, index) => {
      return this.prisma.lms_recursos.update({
        where: { guid },
        data: { orden: index },
      });
    });

    return this.prisma.$transaction(queries);
  }

  async deleteModulo(guid: string, requestUser?: any) {
    // Single query: module + course validation
    const modulo = await this.prisma.lms_modulos.findUnique({
      where: { guid },
      select: { curso_guid: true, curso: { select: { estado: true, profesor_guid: true } } },
    });
    if (!modulo) throw new NotFoundException('Módulo no encontrado');
    this.assertDraftAndOwnership(modulo.curso, requestUser);

    return this.prisma.lms_modulos.delete({ where: { guid } });
  }
}
