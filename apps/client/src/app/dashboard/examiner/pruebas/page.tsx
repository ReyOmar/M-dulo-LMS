"use client";

import { useEffect, useState, useMemo } from "react";
import { ClipboardCheck, Download, Loader2, Check, Search, FileText, Star, MessageSquare, X, ArrowLeft, ArrowRight, BarChart3, TrendingUp, ChevronDown, ChevronUp, Image as ImageIcon, PieChart as PieChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { PageLoader } from "@/components/ui/PageLoader";
import { useRole } from "@/contexts/RoleContext";
import { useWS } from "@/contexts/WebSocketContext";
import api, { API_BASE_URL } from "@/lib/api";
import { useAlert } from "@/contexts/AlertContext";

export default function MonitoreoPruebasPage() {
  const { user } = useRole();
  const { subscribe } = useWS();
  const [entregas, setEntregas] = useState<any[]>([]);
  const [cursos, setCursos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Drill-down state
  const [selectedCourseGuid, setSelectedCourseGuid] = useState<string | null>(null);
  const [courseSearch, setCourseSearch] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "graded">("all");
  
  // Accordion state
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const { showAlert } = useAlert();

  useEffect(() => {
    if (user?.guid) fetchData();
  }, [user?.guid]);

  useEffect(() => {
    if (!user?.guid) return;
    
    const unsub1 = subscribe('submission:new', fetchData);
    const unsub2 = subscribe('submission:graded', fetchData);
    const unsub3 = subscribe('dashboard:refresh', fetchData);
    const unsub4 = subscribe('course:created', fetchData);
    const unsub5 = subscribe('course:updated', fetchData);
    
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
    };
  }, [user?.guid, subscribe]);

  const fetchData = async () => {
    try {
      const [resEntregas, resCursos] = await Promise.all([
        api.get(`/cursos/examiner/entregas?profesor_guid=${user?.guid}`),
        api.get(`/cursos?role=teacher&profesor_guid=${user?.guid}`)
      ]);
      const data = resEntregas.data;
      if (Array.isArray(data)) {
        // Filtrar SOLO los cuestionarios
        setEntregas(data.filter(e => e.tarea_titulo?.startsWith('[QUIZ]')));
      } else {
        setEntregas([]);
      }
      setCursos(resCursos.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const cursosAgrupados = useMemo(() => {
    const map = new Map<string, { guid: string; titulo: string; imagen_portada: string | null; total: number; pending: number; graded: number; entregas: any[] }>();
    
    cursos.forEach(c => {
      map.set(c.guid, {
        guid: c.guid,
        titulo: c.titulo,
        imagen_portada: c.imagen_portada,
        total: 0,
        pending: 0,
        graded: 0,
        entregas: []
      });
    });

    entregas.forEach(e => {
      if (!map.has(e.curso_guid)) {
        map.set(e.curso_guid, {
          guid: e.curso_guid,
          titulo: e.curso_titulo,
          imagen_portada: null,
          total: 0,
          pending: 0,
          graded: 0,
          entregas: []
        });
      }
      const curso = map.get(e.curso_guid)!;
      curso.total++;
      if (e.estado === "CALIFICADA") curso.graded++;
      else curso.pending++;
      curso.entregas.push(e);
    });
    
    return Array.from(map.values());
  }, [entregas, cursos]);

  const selectedCourse = cursosAgrupados.find(c => c.guid === selectedCourseGuid);
  
  const gradeDistribution = useMemo(() => {
    if (!selectedCourse) return [];
    const ranges = [
      { name: "0.0 - 2.9 (Bajo)", count: 0, fill: "#ef4444" }, 
      { name: "3.0 - 3.9 (Medio)", count: 0, fill: "#f59e0b" }, 
      { name: "4.0 - 5.0 (Alto)", count: 0, fill: "#10b981" }, 
    ];
    selectedCourse.entregas.forEach(e => {
      if (e.estado === "CALIFICADA") {
        let val = e.calificacion;
        if (val === undefined || val === null) {
          const notaText = e.contenido_texto?.startsWith("NOTA:") 
            ? e.contenido_texto.replace("NOTA: ", "").split(" | ")[0]
            : null;
          val = notaText ? parseFloat(notaText) : null;
        }
        if (val !== null && !isNaN(val)) {
          if (val < 3) ranges[0].count++;
          else if (val < 4) ranges[1].count++;
          else ranges[2].count++;
        }
      }
    });
    return ranges.filter(r => r.count > 0);
  }, [selectedCourse]);

  const coursePieData = selectedCourse && selectedCourse.total > 0 
    ? [
        { name: "Pendientes", value: selectedCourse.pending, color: "#f59e0b" },
        { name: "Completadas", value: selectedCourse.graded, color: "#10b981" }
      ].filter(d => d.value > 0)
    : [
        { name: "Sin pruebas", value: 1, color: "#94a3b8" }
      ];

  const filtered = useMemo(() => {
    return (selectedCourse?.entregas || []).filter(e => {
      const q = search.toLowerCase();
      const cleanTitle = (e.tarea_titulo || "").replace('[QUIZ] ', '').trim().toLowerCase();
      const matchesSearch =
        e.estudiante?.nombre?.toLowerCase().includes(q) ||
        e.estudiante?.apellido?.toLowerCase().includes(q) ||
        cleanTitle.includes(q);
      
      if (filter === "pending") return matchesSearch && e.estado !== "CALIFICADA";
      if (filter === "graded") return matchesSearch && e.estado === "CALIFICADA";
      return matchesSearch;
    });
  }, [selectedCourse, search, filter]);

  const entregasAgrupadas = useMemo(() => {
    const groups: Record<string, Record<string, any[]>> = {};
    filtered.forEach(e => {
      const modTitle = e.modulo_titulo || 'Módulo Principal';
      const taskTitle = (e.tarea_titulo || 'Sin título').replace('[QUIZ] ', '').trim();
      if (!groups[modTitle]) groups[modTitle] = {};
      if (!groups[modTitle][taskTitle]) groups[modTitle][taskTitle] = [];
      groups[modTitle][taskTitle].push(e);
    });
    
    return Object.entries(groups).map(([modulo_titulo, tareasMap]) => {
      let modPendingCount = 0;
      let modGradedCount = 0;

      const tareas = Object.entries(tareasMap).map(([tarea_titulo, entregas]) => {
        const pendingCount = entregas.filter(e => e.estado !== "CALIFICADA").length;
        const gradedCount = entregas.length - pendingCount;
        modPendingCount += pendingCount;
        modGradedCount += gradedCount;

        return {
          tarea_titulo,
          entregas,
          pendingCount,
          gradedCount
        };
      });

      return {
        modulo_titulo,
        tareas,
        pendingCount: modPendingCount,
        gradedCount: modGradedCount
      };
    });
  }, [filtered]);

  if (!selectedCourseGuid && !loading) {
    if (cursosAgrupados.length === 0) {
      return (
        <div className="animate-in fade-in duration-700">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <ClipboardCheck className="h-8 w-8 text-primary" />
              Monitoreo de Pruebas
            </h1>
            <p className="text-muted-foreground mt-2">
              Selecciona un curso para ver y analizar los resultados de los cuestionarios.
            </p>
          </header>
          <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center shadow-sm">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-lg font-bold">No hay cursos asignados</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Actualmente no tienes cursos asignados para monitorear.
            </p>
          </div>
        </div>
      );
    }

    const filteredCursos = cursosAgrupados.filter(c => 
      c.titulo.toLowerCase().includes(courseSearch.toLowerCase())
    );

    const totalEntregasGlobal = entregas.length;
    const totalPendingGlobal = entregas.filter(e => e.estado !== "CALIFICADA").length;
    const totalGradedGlobal = totalEntregasGlobal - totalPendingGlobal;

    const globalPieData = totalEntregasGlobal > 0 
      ? [
          { name: "En Progreso", value: totalPendingGlobal, color: "#f59e0b" },
          { name: "Completadas", value: totalGradedGlobal, color: "#10b981" }
        ].filter(d => d.value > 0)
      : [
          { name: "Sin pruebas", value: 1, color: "#94a3b8" }
        ];

    const courseBarData = cursosAgrupados
      .filter(c => c.total > 0)
      .map(c => ({
        name: c.titulo.length > 15 ? c.titulo.substring(0, 15) + '...' : c.titulo,
        'En Progreso': c.pending,
        Completadas: c.graded,
        guid: c.guid
      }));

    return (
      <div className="animate-in fade-in duration-700">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8 text-primary" />
            Monitoreo de Pruebas
          </h1>
          <p className="text-muted-foreground mt-2">
            Selecciona un curso para ver y analizar los resultados de los cuestionarios.
          </p>
        </header>

        {/* Global Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
              <span className="text-2xl font-bold">{totalEntregasGlobal}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Total Pruebas (Intentos)</p>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Star className="h-4 w-4 text-amber-500" />
              </div>
              <span className="text-2xl font-bold">{totalPendingGlobal}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">En Progreso Globales</p>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Check className="h-4 w-4 text-emerald-500" />
              </div>
              <span className="text-2xl font-bold">{totalGradedGlobal}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Completadas Globales</p>
          </div>
        </div>

        {/* Global Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                <PieChartIcon className="h-5 w-5 text-primary" />
                Estado Global de Pruebas
              </h3>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={globalPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="var(--card)"
                      strokeWidth={4}
                      cornerRadius={4}
                    >
                      {globalPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      cursor={{ fill: 'currentColor', opacity: 0.05 }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend 
                      verticalAlign="middle" 
                      align="right" 
                      layout="vertical"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '13px', fontWeight: '500', paddingLeft: '20px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                <BarChart3 className="h-5 w-5 text-primary" />
                Cursos con más pruebas
              </h3>
              <div className="h-[180px] w-full">
                {courseBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={courseBarData} 
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      onClick={(state: any) => {
                        if (state && state?.activePayload && state.activePayload.length > 0) {
                          setSelectedCourseGuid(state.activePayload[0].payload.guid);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/40" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'currentColor', fontSize: 12, fontWeight: 600 }}
                        className="text-muted-foreground"
                        dy={10}
                      />
                      <YAxis 
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'currentColor', fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <RechartsTooltip 
                        cursor={{ fill: 'currentColor', opacity: 0.05 }}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', fontWeight: 'bold' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="En Progreso" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={60} />
                      <Bar dataKey="Completadas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={60} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No hay pruebas en los cursos asignados.
                  </div>
                )}
              </div>
            </div>
          </div>

        {cursosAgrupados.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                placeholder="Buscar curso asignado por nombre..."
                className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium shadow-sm transition-all"
              />
              {courseSearch && (
                <button onClick={() => setCourseSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {filteredCursos.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center shadow-sm">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-lg font-bold">Sin cursos para mostrar</h3>
            <p className="text-muted-foreground text-sm mt-1">
              No se encontraron cursos que coincidan con la búsqueda, o no tienes cursos asignados.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCursos.map((curso, idx) => {
              return (
                <div 
                  key={curso.guid || `curso-${idx}`} 
                  className="bg-card border border-border/50 hover:border-primary/50 hover:shadow-md transition-all rounded-2xl p-6 flex flex-col h-full relative"
                >
                  <div className="cursor-pointer group flex-1" onClick={() => setSelectedCourseGuid(curso.guid)}>
                    <h3 className="font-bold text-lg mb-4 group-hover:text-primary transition-colors line-clamp-2 pr-8">
                      {curso.titulo}
                    </h3>
                  </div>
                  
                  <button 
                    onClick={() => setSelectedCourseGuid(curso.guid)}
                    className="absolute top-6 right-6 p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-colors"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  
                  <div className="flex items-center gap-4 mt-auto">
                    <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden relative group/cover bg-muted flex items-center justify-center border border-border">
                      {curso.imagen_portada ? (
                        <img src={`${API_BASE_URL}/cursos/download/${curso.imagen_portada}`} alt="Portada" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-2 cursor-pointer" onClick={() => setSelectedCourseGuid(curso.guid)}>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">En Progreso</span>
                        <span className="font-bold text-amber-500">{curso.pending}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Completadas</span>
                        <span className="font-bold text-emerald-500">{curso.graded}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${curso.total > 0 ? (curso.graded / curso.total) * 100 : 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground w-10 text-right">
                          {curso.total > 0 ? Math.round((curso.graded / curso.total) * 100) : 100}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // View 2: Detailed Course Grading

  if (loading) {
    return <PageLoader message="Cargando pruebas del curso..." />;
  }

  return (
    <div className="animate-in slide-in-from-right-4 duration-500">
      <button 
        onClick={() => { setSelectedCourseGuid(null); setSearch(""); setFilter("all"); }}
        className="mb-6 flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a cursos
      </button>

      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3 mb-6">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          {selectedCourse?.titulo}
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
              <span className="text-2xl font-bold">{selectedCourse?.total}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Total Pruebas</p>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Star className="h-4 w-4 text-amber-500" />
              </div>
              <span className="text-2xl font-bold">{selectedCourse?.pending}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">En Progreso</p>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Check className="h-4 w-4 text-emerald-500" />
              </div>
              <span className="text-2xl font-bold">{selectedCourse?.graded}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Completadas</p>
          </div>
        </div>
      </header>

      {selectedCourse && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
              <PieChartIcon className="h-5 w-5 text-primary" />
              Estado de Pruebas
            </h3>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={coursePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="var(--card)"
                    strokeWidth={4}
                    cornerRadius={4}
                  >
                    {coursePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    cursor={{ fill: 'currentColor', opacity: 0.05 }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend 
                    verticalAlign="middle" 
                    align="right" 
                    layout="vertical"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '13px', fontWeight: '500', paddingLeft: '20px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
              <TrendingUp className="h-5 w-5 text-primary" />
              Distribución de Notas (Completadas)
            </h3>
            <div className="h-[180px] w-full">
              {gradeDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeDistribution} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/40" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'currentColor', fontSize: 12, fontWeight: 600 }}
                      className="text-muted-foreground"
                      dy={10}
                    />
                    <YAxis 
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'currentColor', fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <RechartsTooltip 
                      cursor={{ fill: 'currentColor', opacity: 0.05 }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', fontWeight: 'bold' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value) => [`${value} estudiantes`, 'Cantidad']}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {gradeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                  <Star className="h-8 w-8 opacity-20" />
                  <span>Aún no hay pruebas completadas para mostrar.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search + Filter Row */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por estudiante o cuestionario..."
            className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
          />
        </div>
        <div className="relative w-full sm:w-[200px]">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="w-full bg-card border border-border rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium shadow-sm appearance-none"
          >
            <option value="all">Todas las pruebas</option>
            <option value="pending">En progreso</option>
            <option value="graded">Completadas</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {entregasAgrupadas.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center">
          <ClipboardCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-bold">Sin resultados</h3>
          <p className="text-muted-foreground text-sm mt-1">
            No se encontraron pruebas que coincidan con los filtros en este curso.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {entregasAgrupadas.map(modulo => {
            const isModExpanded = !!expandedModules[modulo.modulo_titulo];

            return (
            <div key={modulo.modulo_titulo} className="animate-in slide-in-from-bottom-2 duration-300">
              <div 
                className={`bg-primary/5 rounded-t-2xl p-4 border border-primary/20 flex items-center gap-3 cursor-pointer select-none transition-colors hover:bg-primary/10 ${!isModExpanded ? 'rounded-b-2xl' : ''}`}
                onClick={() => setExpandedModules(prev => ({ ...prev, [modulo.modulo_titulo]: !prev[modulo.modulo_titulo] }))}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-foreground flex-1 truncate">{modulo.modulo_titulo}</h2>
                
                <div className="hidden sm:flex items-center gap-2">
                  {modulo.pendingCount > 0 ? (
                    <span className="bg-amber-500/10 text-amber-600 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Star className="h-3 w-3" /> {modulo.pendingCount} En Progreso
                    </span>
                  ) : modulo.gradedCount > 0 ? (
                    <span className="bg-emerald-500/10 text-emerald-600 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Check className="h-3 w-3" /> Al día
                    </span>
                  ) : null}
                </div>

                <div className="p-2 bg-background/50 rounded-lg shrink-0">
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${isModExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {isModExpanded && (
                <div className="border border-t-0 border-border rounded-b-2xl p-4 sm:p-6 bg-card space-y-6">
                  {modulo.tareas.map(grupo => {
                    const taskKey = `${modulo.modulo_titulo}-${grupo.tarea_titulo}`;
                    const isTaskExpanded = !!expandedTasks[taskKey];

                    return (
                    <div key={grupo.tarea_titulo} className="space-y-4">
                      <div 
                        className="flex items-center gap-3 pb-2 border-b border-border/50 cursor-pointer select-none group"
                        onClick={() => setExpandedTasks(prev => ({ ...prev, [taskKey]: !prev[taskKey] }))}
                      >
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors shrink-0">
                          <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-foreground flex-1 truncate group-hover:text-primary transition-colors">{grupo.tarea_titulo}</h3>
                        
                        <div className="flex items-center gap-2">
                          {grupo.pendingCount > 0 ? (
                            <span className="bg-amber-500/10 text-amber-600 text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-3 sm:py-1 rounded-full">
                              {grupo.pendingCount} En progreso
                            </span>
                          ) : grupo.gradedCount > 0 ? (
                            <span className="bg-emerald-500/10 text-emerald-600 text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-3 sm:py-1 rounded-full">
                              Completados
                            </span>
                          ) : (
                            <span className="bg-muted text-muted-foreground text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-3 sm:py-1 rounded-full">
                              Sin intentos
                            </span>
                          )}
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${isTaskExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>

                      {isTaskExpanded && (
                        <div className="grid grid-cols-1 gap-4 pl-2 md:pl-4 border-l-2 border-border animate-in slide-in-from-top-1 duration-200">
                          {grupo.entregas.map(entrega => {
                            const isCalificada = entrega.estado === "CALIFICADA";
                            let nota = null;
                            if (entrega.calificacion !== null && entrega.calificacion !== undefined) {
                                nota = entrega.calificacion;
                            } else if (entrega.contenido_texto?.startsWith("NOTA:")) {
                                nota = parseFloat(entrega.contenido_texto.replace("NOTA: ", "").split(" | ")[0]);
                            }

                            return (
                              <div
                                key={entrega.guid}
                                className={`bg-background border rounded-2xl overflow-hidden shadow-sm transition-all ${
                                  isCalificada ? "border-emerald-500/30" : "border-border"
                                }`}
                              >
                                <div className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                                  <div className="flex-1 min-w-0 flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                                      isCalificada ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                                    }`}>
                                      {entrega.estudiante?.nombre?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-base text-foreground truncate">
                                          {entrega.estudiante?.nombre} {entrega.estudiante?.apellido}
                                        </h4>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                          isCalificada ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                                        }`}>
                                          {isCalificada ? "Completado" : "En Progreso"}
                                        </span>
                                      </div>
                                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        {entrega.fecha_entrega
                                          ? new Date(entrega.fecha_entrega).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                                          : "Sin fecha"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    {isCalificada && nota !== null ? (
                                      <div className="bg-emerald-500/10 px-4 py-2 rounded-xl flex items-center gap-1">
                                        <span className="text-sm font-black text-emerald-600">{nota}</span>
                                        <span className="text-xs font-bold text-emerald-600/70">/5.0</span>
                                      </div>
                                    ) : (
                                        <div className="bg-amber-500/10 px-4 py-2 rounded-xl flex items-center gap-1">
                                          <span className="text-sm font-black text-amber-600">Pendiente</span>
                                        </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
