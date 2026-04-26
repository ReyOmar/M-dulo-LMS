"use client";

import { useEffect, useState, Fragment } from "react";
import { Search, Users, Clock, BookOpen, ChevronDown, ChevronRight, BarChart3, Loader2, TrendingUp } from "lucide-react";
import { PageLoader } from "@/components/PageLoader";
import { useRole } from "@/contexts/RoleContext";

export default function MonitoreoEstudiantesPage() {
  const { user } = useRole();
  const [estudiantes, setEstudiantes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  useEffect(() => {
    if (user?.guid) fetchMonitoreo();
  }, [user?.guid]);

  const fetchMonitoreo = async () => {
    try {
      const res = await fetch(`http://localhost:3200/api/cursos/examiner/monitoreo?profesor_guid=${user?.guid}`);
      const data = await res.json();
      setEstudiantes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = estudiantes.filter(e => {
    const q = search.toLowerCase();
    return (
      e.nombre?.toLowerCase().includes(q) ||
      e.apellido?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q)
    );
  });

  const formatDate = (d: string) => {
    if (!d) return "Sin registro";
    return new Date(d).toLocaleString("es-ES", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  if (loading) {
    return <PageLoader message="Cargando monitoreo de estudiantes..." />;
  }

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          Monitoreo de Estudiantes
        </h1>
        <p className="text-muted-foreground mt-2">
          Seguimiento del progreso de los estudiantes en tus cursos asignados.
        </p>
      </header>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, apellido o correo..."
            className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <span className="text-2xl font-bold">{estudiantes.length}</span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Total Estudiantes</p>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <span className="text-2xl font-bold">
              {estudiantes.filter(e => e.total_entregas > 0).length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Con Actividad</p>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-amber-500" />
            </div>
            <span className="text-2xl font-bold">
              {estudiantes.reduce((s, e) => s + e.total_entregas, 0)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Total Entregas</p>
        </div>
      </div>

      {/* Students Table */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-bold">Sin resultados</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {search ? "No se encontraron estudiantes con ese criterio de búsqueda." : "No hay estudiantes registrados."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 border-b border-border/50 uppercase text-xs font-bold text-muted-foreground">
              <tr>
                <th className="px-6 py-4 w-8"></th>
                <th className="px-6 py-4">Estudiante</th>
                <th className="px-6 py-4">Correo</th>
                <th className="px-6 py-4">Última Actividad</th>
                <th className="px-6 py-4">Entregas</th>
                <th className="px-6 py-4">Avance General</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map(est => {
                const isExpanded = expandedStudent === est.guid;
                const avgProgress = est.cursos.length > 0
                  ? Math.round(est.cursos.reduce((s: number, c: any) => s + c.porcentaje, 0) / est.cursos.length)
                  : 0;

                return (
                  <Fragment key={est.guid}>
                    <tr

                      onClick={() => setExpandedStudent(isExpanded ? null : est.guid)}
                      className="hover:bg-muted/10 transition-colors cursor-pointer"
                    >
                      <td className="pl-6 py-4">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-primary" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </td>
                      <td className="px-6 py-4 font-bold">{est.nombre} {est.apellido}</td>
                      <td className="px-6 py-4 text-muted-foreground">{est.email}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        <span className="flex items-center gap-1.5 text-xs">
                          <Clock className="h-3 w-3" /> {formatDate(est.ultima_actividad)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${est.total_entregas > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                          {est.total_entregas}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[120px]">
                            <div
                              className={`h-full rounded-full transition-all ${avgProgress >= 80 ? 'bg-emerald-500' : avgProgress >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
                              style={{ width: `${avgProgress}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-muted-foreground w-10">{avgProgress}%</span>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded Detail */}
                    {isExpanded && est.cursos.map((curso: any) => (
                      <tr key={`${est.guid}-${curso.curso_guid}`} className="bg-muted/5 animate-in fade-in duration-200">
                        <td colSpan={6} className="px-12 py-4">
                          <div className="border border-border/50 rounded-xl p-4 bg-background">
                            <div className="flex items-center gap-2 mb-3">
                              <BookOpen className="h-4 w-4 text-primary" />
                              <span className="font-bold text-sm">{curso.curso_titulo}</span>
                              <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                curso.porcentaje >= 80 ? 'bg-emerald-500/10 text-emerald-600' :
                                curso.porcentaje >= 40 ? 'bg-amber-500/10 text-amber-600' :
                                'bg-red-500/10 text-red-500'
                              }`}>
                                {curso.porcentaje}% completado
                              </span>
                            </div>
                            <div className="space-y-2">
                              {curso.modulos.map((mod: any, i: number) => (
                                <div key={i} className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground font-medium w-40 truncate">{mod.titulo}</span>
                                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${mod.porcentaje >= 80 ? 'bg-emerald-500' : mod.porcentaje >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
                                      style={{ width: `${mod.porcentaje}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold text-muted-foreground w-16 text-right">
                                    {mod.completados}/{mod.total}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
