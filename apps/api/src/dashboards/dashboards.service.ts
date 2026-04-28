import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardsService {
  constructor(private prisma: PrismaService) {}

  async getMonitoreoEstudiantes(profesor_guid: string) {
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

    const studentGuids = [...new Set(entregas.map(e => e.usuario_guid))];
    
    const allStudents = await this.prisma.usuarios.findMany({
      where: { rol: 'ESTUDIANTE' },
      select: { guid: true, nombre: true, apellido: true, email: true, updated_at: true }
    });

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

  async getAdminDashboardStats() {
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

    const cursosPublicados = await this.prisma.lms_cursos.count({ where: { estado: 'PUBLICADO' } });
    const cursosBorrador = await this.prisma.lms_cursos.count({ where: { estado: 'BORRADOR' } });
    const totalCursos = cursosPublicados + cursosBorrador;

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
