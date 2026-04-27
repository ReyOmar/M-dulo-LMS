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
    // Security: Validate file extension
    const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.zip', '.rar', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = path.extname(originalName).toLowerCase() || '.bin';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(`Tipo de archivo no permitido: ${ext}`);
    }

    // Security: Sanitize filename to prevent path traversal
    const safeName = path.basename(originalName);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    
    // Remove data:xxx;base64, prefix if present
    const base64Clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const buffer = Buffer.from(base64Clean, 'base64');

    // Security: Enforce max file size (10MB)
    const MAX_SIZE_BYTES = 10 * 1024 * 1024;
    if (buffer.length > MAX_SIZE_BYTES) {
      throw new BadRequestException(`El archivo excede el tamaño máximo permitido (10MB).`);
    }
    
    fs.writeFileSync(path.join(UPLOADS_DIR, uniqueName), buffer);
    return uniqueName;
  }

  getUploadPath(filename: string): string {
    const fullPath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(fullPath)) throw new NotFoundException('Archivo no encontrado');
    return fullPath;
  }

  async submitEntrega(tarea_guid: string, data: { base64: string, nombre_archivo: string, usuario_guid: string }) {
    // 1. Upload file to disk
    const serverFilename = this.uploadFile(data.base64, data.nombre_archivo);

    // 2. Verificar si hay un registro de entrega previo
    let entrega = await this.prisma.lms_entregas.findFirst({
        where: { tarea_guid, usuario_guid: data.usuario_guid }
    });

    if (entrega) {
        entrega = await this.prisma.lms_entregas.update({
            where: { guid: entrega.guid },
            data: {
                url_archivo_adjunto: serverFilename, // Nombre del archivo en disco (uploads/)
                respuesta_texto: data.nombre_archivo, // Nombre original del archivo
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

  // --- EXAMINER METHODS ---

  async getMonitoreoEstudiantes(profesor_guid: string) {
    // 1. Get courses assigned to this professor
    const cursos = await this.prisma.lms_cursos.findMany({
      where: { profesor_guid },
      include: {
        modulos: {
          include: {
            lecciones: {
              include: {
                recursos: { select: { guid: true, tipo: true, titulo: true } }
              }
            }
          }
        }
      }
    });

    if (cursos.length === 0) return [];

    // 2. Get all entregas for these courses' resources
    const allResourceGuids: string[] = [];
    const cursoResourceMap: Record<string, { curso_guid: string; curso_titulo: string; modulo_titulo: string; total_recursos: number }[]> = {};
    
    for (const curso of cursos) {
      for (const mod of curso.modulos) {
        const recursos = mod.lecciones.flatMap(l => l.recursos);
        for (const r of recursos) {
          allResourceGuids.push(r.guid);
          if (!cursoResourceMap[r.guid]) cursoResourceMap[r.guid] = [];
          cursoResourceMap[r.guid].push({
            curso_guid: curso.guid,
            curso_titulo: curso.titulo,
            modulo_titulo: mod.titulo,
            total_recursos: recursos.length
          });
        }
      }
    }

    const entregas = await this.prisma.lms_entregas.findMany({
      where: { tarea_guid: { in: allResourceGuids } },
      select: {
        usuario_guid: true,
        tarea_guid: true,
        estado: true,
        fecha_entrega: true,
      }
    });

    // 3. Get unique student guids
    const studentGuids = [...new Set(entregas.map(e => e.usuario_guid))];
    
    // Also get all students (role ESTUDIANTE)
    const allStudents = await this.prisma.usuarios.findMany({
      where: { rol: 'ESTUDIANTE' },
      select: { guid: true, nombre: true, apellido: true, email: true, updated_at: true }
    });

    // 4. Build result — for each student, calculate progress per course
    const result = allStudents.map(student => {
      const studentEntregas = entregas.filter(e => e.usuario_guid === student.guid);
      const completedResources = new Set(studentEntregas.map(e => e.tarea_guid));

      const cursosProgress = cursos.map(curso => {
        const totalRecursos = curso.modulos.reduce((sum, mod) => 
          sum + mod.lecciones.reduce((s, l) => s + l.recursos.length, 0), 0);
        const completados = curso.modulos.reduce((sum, mod) => {
          const recursos = mod.lecciones.flatMap(l => l.recursos);
          return sum + recursos.filter(r => completedResources.has(r.guid)).length;
        }, 0);

        return {
          curso_guid: curso.guid,
          curso_titulo: curso.titulo,
          total_recursos: totalRecursos,
          completados,
          porcentaje: totalRecursos > 0 ? Math.round((completados / totalRecursos) * 100) : 0,
          modulos: curso.modulos.map(mod => {
            const modRecursos = mod.lecciones.flatMap(l => l.recursos);
            const modCompletados = modRecursos.filter(r => completedResources.has(r.guid)).length;
            return {
              titulo: mod.titulo,
              total: modRecursos.length,
              completados: modCompletados,
              porcentaje: modRecursos.length > 0 ? Math.round((modCompletados / modRecursos.length) * 100) : 0
            };
          })
        };
      });

      return {
        guid: student.guid,
        nombre: student.nombre,
        apellido: student.apellido,
        email: student.email,
        ultima_actividad: student.updated_at,
        total_entregas: studentEntregas.length,
        cursos: cursosProgress
      };
    });

    return result;
  }

  async getEntregasParaCalificar(profesor_guid: string) {
    // 1. Get courses assigned to this professor
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

    // 2. Get all entregas for these tareas
    const entregas = await this.prisma.lms_entregas.findMany({
      where: { tarea_guid: { in: tareaGuids } },
      orderBy: { fecha_entrega: 'desc' }
    });

    // 3. Get student info
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
    return this.prisma.lms_entregas.update({
      where: { guid },
      data: {
        estado: 'CALIFICADA' as any,
        contenido_texto: `NOTA: ${data.calificacion}${data.comentario ? ` | ${data.comentario}` : ''}`
      }
    });
  }

  // --- STUDENT METHODS ---

  async getProgresoEstudiante(usuario_guid: string, curso_guid: string) {
    // Get all resources for this course
    const curso = await this.prisma.lms_cursos.findUnique({
      where: { guid: curso_guid },
      include: {
        modulos: {
          orderBy: { orden: 'asc' },
          include: {
            lecciones: {
              include: {
                recursos: { orderBy: { orden: 'asc' }, select: { guid: true } }
              }
            }
          }
        }
      }
    });
    if (!curso) return { completados: [] };

    const recursoGuids = curso.modulos.flatMap((m: any) =>
      m.lecciones.flatMap((l: any) => l.recursos.map((r: any) => r.guid))
    );

    const progreso = await this.prisma.lms_progreso_recurso.findMany({
      where: { usuario_guid, recurso_guid: { in: recursoGuids } }
    });

    return { completados: progreso.map((p: any) => p.recurso_guid), total_recursos: recursoGuids.length };
  }

  async marcarRecursoCompletado(usuario_guid: string, recurso_guid: string) {
    // Upsert — if already exists, do nothing
    const existing = await this.prisma.lms_progreso_recurso.findUnique({
      where: { usuario_guid_recurso_guid: { usuario_guid, recurso_guid } }
    });
    if (existing) return existing;

    return this.prisma.lms_progreso_recurso.create({
      data: { usuario_guid, recurso_guid, completado: true }
    });
  }

  async getDiasActivos(usuario_guid: string, year: number, month: number) {
    // month is 0-indexed from frontend
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);

    const [progresos, entregas] = await Promise.all([
      this.prisma.lms_progreso_recurso.findMany({
        where: { usuario_guid, fecha_completado: { gte: start, lt: end } },
        select: { fecha_completado: true }
      }),
      this.prisma.lms_entregas.findMany({
        where: { usuario_guid, fecha_entrega: { gte: start, lt: end } },
        select: { fecha_entrega: true }
      })
    ]);

    const days = new Set<number>();
    for (const p of progresos) {
      days.add(new Date(p.fecha_completado).getDate());
    }
    for (const e of entregas) {
      if (e.fecha_entrega) days.add(new Date(e.fecha_entrega).getDate());
    }

    return { dias: Array.from(days).sort((a, b) => a - b) };
  }

  async getNotificacionesEstudiante(usuario_guid: string) {
    return this.prisma.lms_notificaciones.findMany({
      where: { usuario_guid },
      orderBy: { created_at: 'desc' },
      take: 20
    });
  }

  async marcarNotificacionLeida(id: number) {
    return this.prisma.lms_notificaciones.update({
      where: { id },
      data: { leida: true }
    });
  }

  async getMetricasEstudiante(usuario_guid: string) {
    let metricas = await this.prisma.lms_metricas_capacitacion.findUnique({
      where: { usuario_guid }
    });
    if (!metricas) {
      // Create default metrics if not found
      metricas = await this.prisma.lms_metricas_capacitacion.create({
        data: { usuario_guid }
      });
    }
    return metricas;
  }

  // --- MATRICULATION ---

  async matricularEstudiante(curso_guid: string, usuario_guid: string) {
    const existing = await this.prisma.lms_matriculas.findUnique({
      where: { usuario_guid_curso_guid: { usuario_guid, curso_guid } }
    });
    if (existing) return existing;

    return this.prisma.lms_matriculas.create({
      data: { usuario_guid, curso_guid, tipo: 'MANUAL' as any }
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
      }
    });
  }

  async getEstudiantesDisponibles() {
    return this.prisma.usuarios.findMany({
      where: { rol: 'ESTUDIANTE' },
      select: { guid: true, nombre: true, apellido: true, email: true }
    });
  }

  async seedMatriculas() {
    // Assign all published courses to all students
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
            data: { usuario_guid: est.guid, curso_guid: curso.guid, tipo: 'MANUAL' as any }
          });
          count++;
        }
      }
    }
    return { matriculas_creadas: count };
  }

  // --- ADMIN DASHBOARD STATS ---

  async getAdminDashboardStats() {
    // 1. User counts — "active" means professor with at least 1 course, student with at least 1 enrollment
    const profesores = await this.prisma.usuarios.findMany({ where: { rol: 'PROFESOR', activo: true }, select: { guid: true } });
    let profesoresActivos = 0;
    for (const p of profesores) {
      const tieneC = await this.prisma.lms_cursos.count({ where: { profesor_guid: p.guid } });
      if (tieneC > 0) profesoresActivos++;
    }
    const estudiantes = await this.prisma.usuarios.findMany({ where: { rol: 'ESTUDIANTE', activo: true }, select: { guid: true } });
    let estudiantesActivos = 0;
    for (const e of estudiantes) {
      const tieneM = await this.prisma.lms_matriculas.count({ where: { usuario_guid: e.guid } });
      if (tieneM > 0) estudiantesActivos++;
    }
    const totalUsuariosActivos = profesoresActivos + estudiantesActivos;

    // 2. Course counts
    const cursosPublicados = await this.prisma.lms_cursos.count({ where: { estado: 'PUBLICADO' } });
    const cursosBorrador = await this.prisma.lms_cursos.count({ where: { estado: 'BORRADOR' } });
    const totalCursos = cursosPublicados + cursosBorrador;

    // 3. Average grade from calificadas entregas
    const entregasCalificadas = await this.prisma.lms_entregas.findMany({
      where: { estado: 'CALIFICADA' },
      select: { contenido_texto: true }
    });
    let sumaNotas = 0;
    let countNotas = 0;
    for (const e of entregasCalificadas) {
      if (e.contenido_texto?.startsWith('NOTA:')) {
        const nota = parseFloat(e.contenido_texto.replace('NOTA: ', '').split('|')[0].trim());
        if (!isNaN(nota)) {
          sumaNotas += nota;
          countNotas++;
        }
      }
    }
    const promedioGlobal = countNotas > 0 ? Math.round((sumaNotas / countNotas) * 10) / 10 : 0;

    // 4. Weekly activity — entregas per day for the last 7 days
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const now = new Date();
    const weeklyActivity: { day: string; sesiones: number; entregas: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

      const entregas = await this.prisma.lms_entregas.count({
        where: {
          fecha_entrega: { gte: dayStart, lt: dayEnd }
        }
      });

      const recursosCompletados = await this.prisma.lms_progreso_recurso.count({
        where: {
          fecha_completado: { gte: dayStart, lt: dayEnd }
        }
      });

      weeklyActivity.push({
        day: dayNames[dayStart.getDay()],
        sesiones: recursosCompletados,
        entregas
      });
    }

    // 5. Course distribution — matriculas per course
    const cursos = await this.prisma.lms_cursos.findMany({
      where: { estado: 'PUBLICADO' },
      select: { guid: true, titulo: true }
    });
    const colors = [
      'hsl(210, 80%, 55%)', 'hsl(150, 65%, 45%)', 'hsl(280, 65%, 55%)',
      'hsl(35, 85%, 55%)', 'hsl(350, 70%, 55%)', 'hsl(190, 70%, 50%)',
      'hsl(60, 70%, 50%)', 'hsl(0, 0%, 60%)'
    ];
    const courseDistribution: { name: string; value: number; color: string }[] = [];
    for (let i = 0; i < cursos.length; i++) {
      const count = await this.prisma.lms_matriculas.count({ where: { curso_guid: cursos[i].guid } });
      courseDistribution.push({
        name: cursos[i].titulo.length > 25 ? cursos[i].titulo.substring(0, 25) + '...' : cursos[i].titulo,
        value: count,
        color: colors[i % colors.length]
      });
    }

    // 6. Total matriculas
    const totalMatriculas = await this.prisma.lms_matriculas.count();

    return {
      usuarios: { total: totalUsuariosActivos, estudiantes: estudiantesActivos, profesores: profesoresActivos },
      cursos: { publicados: cursosPublicados, borrador: cursosBorrador, total: totalCursos },
      promedioGlobal,
      weeklyActivity,
      courseDistribution,
      totalMatriculas,
      timestamp: new Date().toISOString()
    };
  }
}
