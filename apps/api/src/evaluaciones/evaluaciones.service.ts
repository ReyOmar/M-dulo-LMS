import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { lms_estado_entrega } from '@prisma/client';
import { LmsGateway } from '../ws/lms.gateway';

@Injectable()
export class EvaluacionesService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private lmsGateway: LmsGateway,
  ) {}

  async submitEntrega(tarea_guid: string, data: { base64: string, nombre_archivo: string, usuario_guid: string }) {
    const serverFilename = await this.storageService.uploadFile(data.base64, data.nombre_archivo);

    let entrega = await this.prisma.lms_entregas.findFirst({
        where: { tarea_guid, usuario_guid: data.usuario_guid }
    });

    if (entrega) {
        entrega = await this.prisma.lms_entregas.update({
            where: { guid: entrega.guid },
            data: {
                url_archivo_adjunto: serverFilename,
                respuesta_texto: data.nombre_archivo,
                estado: 'ENTREGADA',
                fecha_entrega: new Date()
            }
        });
    } else {
        entrega = await this.prisma.lms_entregas.create({
            data: {
                tarea_guid,
                usuario_guid: data.usuario_guid,
                url_archivo_adjunto: serverFilename,
                respuesta_texto: data.nombre_archivo,
                estado: 'ENTREGADA'
            }
        });
    }

    // Notify teachers/admins about the new submission
    this.lmsGateway.broadcast('submission:new', { 
      tarea_guid, 
      usuario_guid: data.usuario_guid,
      estado: 'ENTREGADA'
    });
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'submission_new' });

    return entrega;
  }

  async getEntrega(tarea_guid: string, usuario_guid: string) {
    return this.prisma.lms_entregas.findFirst({
        where: { tarea_guid, usuario_guid },
        select: {
            guid: true,
            estado: true,
            fecha_entrega: true,
            respuesta_texto: true,
            url_archivo_adjunto: true,
            contenido_texto: true,
        }
    });
  }

  async getTodasEntregasParaTarea(tarea_guid: string) {
    return this.prisma.lms_entregas.findMany({
        where: { tarea_guid },
        select: {
            guid: true,
            estado: true,
            fecha_entrega: true,
            respuesta_texto: true,
            usuario_guid: true,
        },
        orderBy: { fecha_entrega: 'desc' }
    });
  }

  async getEntregasParaCalificar(profesor_guid: string) {
    const cursos = await this.prisma.lms_cursos.findMany({
      where: { profesor_guid },
      include: {
        modulos: {
          include: {
            lecciones: {
              include: {
                recursos: {
                  where: { tipo: 'TAREA' },
                  select: { guid: true, titulo: true, archivo_max_size_mb: true }
                }
              }
            }
          }
        }
      }
    });

    const tareaGuids: string[] = [];
    const tareaInfo: Record<string, { titulo: string; curso_titulo: string }> = {};

    for (const curso of cursos) {
      for (const mod of curso.modulos) {
        for (const lec of mod.lecciones) {
          for (const rec of lec.recursos) {
            tareaGuids.push(rec.guid);
            tareaInfo[rec.guid] = { titulo: rec.titulo, curso_titulo: curso.titulo };
          }
        }
      }
    }

    if (tareaGuids.length === 0) return [];

    const entregas = await this.prisma.lms_entregas.findMany({
      where: { tarea_guid: { in: tareaGuids } },
      orderBy: { fecha_entrega: 'desc' },
      take: 500
    });

    const studentGuids = [...new Set(entregas.map(e => e.usuario_guid))];
    const students = await this.prisma.usuarios.findMany({
      where: { guid: { in: studentGuids } },
      select: { guid: true, nombre: true, apellido: true, email: true }
    });
    const studentMap = Object.fromEntries(students.map(s => [s.guid, s]));

    return entregas.map(e => ({
      guid: e.guid,
      tarea_guid: e.tarea_guid,
      tarea_titulo: tareaInfo[e.tarea_guid || '']?.titulo || 'Sin título',
      curso_titulo: tareaInfo[e.tarea_guid || '']?.curso_titulo || 'Sin curso',
      estudiante: studentMap[e.usuario_guid] || { nombre: 'Desconocido', apellido: '', email: '' },
      archivo_nombre: e.respuesta_texto,
      archivo_servidor: e.url_archivo_adjunto,
      estado: e.estado,
      fecha_entrega: e.fecha_entrega,
      contenido_texto: e.contenido_texto,
    }));
  }

  async calificarEntrega(guid: string, data: { calificacion: number; comentario?: string }) {
    const entrega = await this.prisma.lms_entregas.update({
      where: { guid },
      data: {
        estado: 'CALIFICADA' as lms_estado_entrega,
        contenido_texto: `NOTA: ${data.calificacion}${data.comentario ? ` | ${data.comentario}` : ''}`
      }
    });

    if (data.calificacion >= 3.0 && entrega.tarea_guid) {
      const existing = await this.prisma.lms_progreso_recurso.findUnique({
        where: {
          usuario_guid_recurso_guid: {
            usuario_guid: entrega.usuario_guid,
            recurso_guid: entrega.tarea_guid
          }
        }
      });
      if (!existing) {
        await this.prisma.lms_progreso_recurso.create({
          data: {
            usuario_guid: entrega.usuario_guid,
            recurso_guid: entrega.tarea_guid,
            completado: true
          }
        });
      }
    }

    // Notify the student that their assignment has been graded
    this.lmsGateway.broadcast('submission:graded', {
      guid,
      tarea_guid: entrega.tarea_guid,
      calificacion: data.calificacion
    }, [entrega.usuario_guid]);
    this.lmsGateway.broadcast('dashboard:refresh', { reason: 'submission_graded' }, [entrega.usuario_guid]);

    return entrega;
  }
}
