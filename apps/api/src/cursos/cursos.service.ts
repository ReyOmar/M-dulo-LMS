import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { lms_tipo_recurso } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

@Injectable()
export class CursosService {
  constructor(private prisma: PrismaService) {
    // Ensure uploads directory exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  }

  async getCursosActivosParaEstudiante() {
    return this.prisma.lms_cursos.findMany({
      where: { estado: 'PUBLICADO' },
      orderBy: { created_at: 'desc' }
    });
  }

  async getAllCursosParaAdmin() {
    return this.prisma.lms_cursos.findMany({
      orderBy: { created_at: 'desc' }
    });
  }

  async getProfesores() {
    return this.prisma.usuarios.findMany({
        where: { rol: 'PROFESOR' },
        select: { guid: true, nombre: true, apellido: true, email: true }
    });
  }

  async asignarCurso(curso_guid: string, profesor_guid: string) {
    return this.prisma.lms_cursos.update({
        where: { guid: curso_guid },
        data: { profesor_guid }
    });
  }

  async getCursosDeProfesor(profesor_guid: string) {
    return this.prisma.lms_cursos.findMany({
        where: { profesor_guid, estado: 'PUBLICADO' },
        orderBy: { created_at: 'desc' }
    });
  }

  async getCursosDeEstudiante(estudiante_guid: string) {
    const matriculas = await this.prisma.lms_matriculas.findMany({
      where: { usuario_guid: estudiante_guid },
      include: { curso: true },
      orderBy: { fecha_matricula: 'desc' }
    });
    return matriculas.map((m: any) => m.curso);
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

  async createCurso(data: { titulo: string; profesor_guid: string }) {
    let guidFinal = data.profesor_guid;
    
    // Si no hay profesor_guid proporcionado, asignar al primer admin/profesor disponible
    if (!guidFinal) {
        const fallBackAdmin = await this.prisma.usuarios.findFirst({
            where: { rol: { in: ['ADMINISTRADOR', 'PROFESOR'] } }
        });
        if (fallBackAdmin) guidFinal = fallBackAdmin.guid;
    }

    return this.prisma.lms_cursos.create({
      data: {
        titulo: data.titulo,
        estado: 'BORRADOR',
        profesor_guid: guidFinal,
      }
    });
  }

  async updateCurso(curso_guid: string, data: { titulo: string; estado: string }) {
    return this.prisma.lms_cursos.update({
        where: { guid: curso_guid },
        data: {
            titulo: data.titulo,
            estado: data.estado as any
        }
    });
  }

  async createModuloParaCurso(curso_guid: string, data: { titulo: string; orden?: number }) {
    // Verificar si el curso existe
    const curso = await this.prisma.lms_cursos.findUnique({ where: { guid: curso_guid } });
    if (!curso) throw new NotFoundException('Curso no encontrado');

    const orden = data.orden ?? await this.prisma.lms_modulos.count({ where: { curso_guid } });

    // Transaction: Creates a modulo and historically required 'leccion' in one go
    return this.prisma.$transaction(async (tx) => {
        const modulo = await tx.lms_modulos.create({
            data: {
                curso_guid,
                titulo: data.titulo,
                orden
            }
        });

        // Crear una lección interna en blanco obligatoria por el schema
        await tx.lms_lecciones.create({
            data: {
                modulo_guid: modulo.guid,
                titulo: 'Lección Interna Módulo ' + modulo.guid,
                orden: 0
            }
        });

        return modulo;
    });
  }

  async updateModulo(modulo_guid: string, data: { titulo: string }) {
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

  // Save a base64 file to disk and return the filename
  uploadFile(base64Data: string, originalName: string): string {
    const ext = path.extname(originalName) || '.bin';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    
    // Remove data:xxx;base64, prefix if present
    const base64Clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const buffer = Buffer.from(base64Clean, 'base64');
    
    fs.writeFileSync(path.join(UPLOADS_DIR, uniqueName), buffer);
    return uniqueName;
  }

  getUploadPath(filename: string): string {
    const fullPath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(fullPath)) throw new NotFoundException('Archivo no encontrado');
    return fullPath;
  }

  async submitEntrega(tarea_guid: string, data: { base64: string, nombre_archivo: string, usuario_guid: string }) {
    // 1. Verificar si hay un registro de entrega previo
    let entrega = await this.prisma.lms_entregas.findFirst({
        where: { tarea_guid, usuario_guid: data.usuario_guid }
    });

    if (entrega) {
        entrega = await this.prisma.lms_entregas.update({
            where: { guid: entrega.guid },
            data: {
                url_archivo_adjunto: data.base64,
                respuesta_texto: data.nombre_archivo, // Usando respuesta_texto para almacenar el nombre del archivo subido
                estado: 'ENTREGADA',
                fecha_entrega: new Date()
            }
        });
    } else {
        entrega = await this.prisma.lms_entregas.create({
            data: {
                tarea_guid,
                usuario_guid: data.usuario_guid,
                url_archivo_adjunto: data.base64,
                respuesta_texto: data.nombre_archivo,
                estado: 'ENTREGADA'
            }
        });
    }
    return entrega;
  }

  async getEntrega(tarea_guid: string, usuario_guid: string) {
    return this.prisma.lms_entregas.findFirst({
        where: { tarea_guid, usuario_guid },
        select: {
            guid: true,
            estado: true,
            fecha_entrega: true,
            respuesta_texto: true, // nombre del archivo guardado aquí
            url_archivo_adjunto: true,
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
            respuesta_texto: true, // nombre del archivo
            usuario_guid: true,
        },
        orderBy: { fecha_entrega: 'desc' }
    });
  }

  async deleteBloque(guid: string) {
    return this.prisma.lms_recursos.delete({
        where: { guid }
    });
  }

  async deleteModulo(guid: string) {
    return this.prisma.lms_modulos.delete({
        where: { guid }
    });
  }

  async deleteCurso(guid: string) {
    return this.prisma.lms_cursos.delete({
        where: { guid }
    });
  }
}
