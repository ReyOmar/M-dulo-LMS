import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardsService {
  constructor(private prisma: PrismaService) {}

  async getMonitoreoEstudiantes(usuario_guid: string, role: string) {
    // Admin sees all courses, professor sees only their own
    const whereClause = role === 'ADMINISTRADOR' ? {} : { profesor_guid: usuario_guid };
    const cursos = await this.prisma.lms_cursos.findMany({
      where: whereClause,
      include: {
        modulos: {
          include: {
            lecciones: {
              include: {
                recursos: { select: { guid: true, tipo: true, titulo: true } },
              },
            },
          },
        },
      },
    });

    if (cursos.length === 0) return [];

    const cursoGuids = cursos.map((c) => c.guid);
    const allResourceGuids: string[] = [];

    for (const curso of cursos) {
      for (const mod of curso.modulos) {
        const recursos = mod.lecciones.flatMap((l: { recursos: { guid: string }[] }) => l.recursos);
        for (const r of recursos) {
          allResourceGuids.push(r.guid);
        }
      }
    }

    const matriculas = await this.prisma.lms_matriculas.findMany({
      where: { curso_guid: { in: cursoGuids } },
      select: { usuario_guid: true, curso_guid: true },
    });

    const enrolledStudentGuids = [...new Set(matriculas.map((m) => m.usuario_guid))];
    if (enrolledStudentGuids.length === 0) return [];

    // Run remaining queries in parallel
    const [enrolledStudents, entregas, progresos] = await Promise.all([
      this.prisma.usuarios.findMany({
        where: { guid: { in: enrolledStudentGuids } },
        select: { guid: true, nombre: true, apellido: true, email: true, ultimo_acceso: true },
      }),
      this.prisma.lms_entregas.findMany({
        where: { tarea_guid: { in: allResourceGuids } },
        select: { usuario_guid: true, tarea_guid: true, fecha_entrega: true },
      }),
      this.prisma.lms_progreso_recurso.findMany({
        where: { recurso_guid: { in: allResourceGuids } },
        select: { usuario_guid: true, recurso_guid: true },
      }),
    ]);

    const result = enrolledStudents.map((student) => {
      const studentEntregas = entregas.filter((e) => e.usuario_guid === student.guid);
      const studentProgresos = progresos.filter((p) => p.usuario_guid === student.guid);
      const completedResources = new Set(studentProgresos.map((p) => p.recurso_guid));
      const studentEnrolledCourseGuids = new Set(
        matriculas.filter((m) => m.usuario_guid === student.guid).map((m) => m.curso_guid),
      );

      const cursosProgress = cursos
        .filter((curso) => studentEnrolledCourseGuids.has(curso.guid))
        .map((curso) => {
          const totalRecursos = curso.modulos.reduce(
            (sum, mod) =>
              sum + mod.lecciones.reduce((s: number, l: { recursos: { guid: string }[] }) => s + l.recursos.length, 0),
            0,
          );

          const completados = curso.modulos.reduce((sum, mod) => {
            const recursos = mod.lecciones.flatMap((l: { recursos: { guid: string }[] }) => l.recursos);
            return sum + recursos.filter((r: { guid: string }) => completedResources.has(r.guid)).length;
          }, 0);

          return {
            curso_guid: curso.guid,
            curso_titulo: curso.titulo,
            total_recursos: totalRecursos,
            completados,
            porcentaje: totalRecursos > 0 ? Math.round((completados / totalRecursos) * 100) : 0,
            modulos: curso.modulos.map((mod) => {
              const modRecursos = mod.lecciones.flatMap((l: { recursos: { guid: string }[] }) => l.recursos);
              const modCompletados = modRecursos.filter((r: { guid: string }) => completedResources.has(r.guid)).length;
              return {
                titulo: mod.titulo,
                total: modRecursos.length,
                completados: modCompletados,
                porcentaje: modRecursos.length > 0 ? Math.round((modCompletados / modRecursos.length) * 100) : 0,
              };
            }),
          };
        });

      return {
        guid: student.guid,
        nombre: student.nombre,
        apellido: student.apellido,
        email: student.email,
        ultimo_acceso: student.ultimo_acceso,
        total_entregas: studentEntregas.length,
        cursos: cursosProgress,
      };
    });

    return result;
  }

  async getAdminDashboardStats() {
    // Run all independent queries in parallel for maximum speed
    const [
      profesores,
      estudiantes,
      cursosPublicados,
      cursosBorrador,
      entregasCalificadas,
      totalMatriculas,
      cursos,
      allMatriculas,
      allCursosProfesores,
    ] = await Promise.all([
      this.prisma.usuarios.findMany({ where: { rol: 'PROFESOR', activo: true }, select: { guid: true } }),
      this.prisma.usuarios.findMany({ where: { rol: 'ESTUDIANTE', activo: true }, select: { guid: true } }),
      this.prisma.lms_cursos.count({ where: { estado: 'PUBLICADO' } }),
      this.prisma.lms_cursos.count({ where: { estado: 'BORRADOR' } }),
      this.prisma.lms_entregas.findMany({
        where: { estado: 'CALIFICADA', calificacion: { not: null } },
        select: { calificacion: true },
      }),
      this.prisma.lms_matriculas.count(),
      this.prisma.lms_cursos.findMany({ where: { estado: 'PUBLICADO' }, select: { guid: true, titulo: true } }),
      this.prisma.lms_matriculas.findMany({ select: { usuario_guid: true, curso_guid: true } }),
      // Fetch profesor assignments to determine active professors (avoids extra sequential query)
      this.prisma.lms_cursos.findMany({ select: { profesor_guid: true } }),
    ]);

    // Count active professors/students using batch data (no extra queries)
    const profGuids = new Set(profesores.map((p) => p.guid));
    const estudGuids = new Set(estudiantes.map((e) => e.guid));
    const matriculasByUser = new Map<string, number>();
    const matriculasByCourse = new Map<string, number>();

    for (const m of allMatriculas) {
      matriculasByUser.set(m.usuario_guid, (matriculasByUser.get(m.usuario_guid) || 0) + 1);
      matriculasByCourse.set(m.curso_guid, (matriculasByCourse.get(m.curso_guid) || 0) + 1);
    }

    // Professor is active if they have at least one course assigned
    const profGuidsWithCourses = new Set(allCursosProfesores.map((c) => c.profesor_guid).filter(Boolean));
    const profesoresActivos = [...profGuids].filter((g) => profGuidsWithCourses.has(g)).length || profesores.length;
    const estudiantesActivos = [...estudGuids].filter((g) => matriculasByUser.has(g)).length;

    // Average grades from calificadas — use numeric field directly
    let sumaNotas = 0,
      countNotas = 0;
    for (const e of entregasCalificadas) {
      if (e.calificacion != null) {
        sumaNotas += Number(e.calificacion);
        countNotas++;
      }
    }
    const promedioGlobal = countNotas > 0 ? Math.round((sumaNotas / countNotas) * 10) / 10 : 0;

    // Weekly activity — combine two sources for accurate connection tracking:
    // 1. lms_sesion_activa: course heartbeat sessions (reliable historical data)
    // 2. usuarios.ultimo_acceso: last API activity per user (captures logins without course sessions)
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const [weekEntregas, weekSesiones, activeUsers] = await Promise.all([
      this.prisma.lms_entregas.findMany({
        where: { fecha_entrega: { gte: weekStart } },
        select: { fecha_entrega: true },
      }),
      this.prisma.lms_sesion_activa.findMany({
        where: { inicio_sesion: { gte: weekStart } },
        select: { usuario_guid: true, inicio_sesion: true },
      }),
      this.prisma.usuarios.findMany({
        where: { ultimo_acceso: { gte: weekStart }, activo: true },
        select: { guid: true, ultimo_acceso: true },
      }),
    ]);

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const weeklyActivity: { day: string; conexiones: number; entregas: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

      // Merge unique users from both sources for this day
      const uniqueUsers = new Set<string>();
      for (const s of weekSesiones) {
        if (s.inicio_sesion >= dayStart && s.inicio_sesion < dayEnd) {
          uniqueUsers.add(s.usuario_guid);
        }
      }
      for (const u of activeUsers) {
        if (u.ultimo_acceso && u.ultimo_acceso >= dayStart && u.ultimo_acceso < dayEnd) {
          uniqueUsers.add(u.guid);
        }
      }

      weeklyActivity.push({
        day: dayNames[dayStart.getDay()],
        conexiones: uniqueUsers.size,
        entregas: weekEntregas.filter((e) => e.fecha_entrega && e.fecha_entrega >= dayStart && e.fecha_entrega < dayEnd)
          .length,
      });
    }

    // Course distribution from pre-fetched data
    const colors = [
      '#6366f1',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#06b6d4',
      '#ec4899',
      '#14b8a6',
      '#f97316',
      '#64748b',
    ];
    const courseDistribution = cursos.map((c, i) => ({
      name: c.titulo.length > 25 ? c.titulo.substring(0, 25) + '...' : c.titulo,
      value: matriculasByCourse.get(c.guid) || 0,
      color: colors[i % colors.length],
    }));

    return {
      usuarios: {
        total: profesoresActivos + estudiantesActivos,
        estudiantes: estudiantesActivos,
        profesores: profesoresActivos,
      },
      cursos: { publicados: cursosPublicados, borrador: cursosBorrador, total: cursosPublicados + cursosBorrador },
      promedioGlobal,
      weeklyActivity,
      courseDistribution,
      totalMatriculas,
      timestamp: new Date().toISOString(),
    };
  }
}
