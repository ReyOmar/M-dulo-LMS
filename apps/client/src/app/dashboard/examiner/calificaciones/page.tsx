"use client";

import { useEffect, useState, useMemo } from "react";
import { BookCheck, Download, Loader2, Check, Search, FileText, Star, MessageSquare, X, ArrowLeft, ArrowRight, BarChart3, TrendingUp, ChevronDown, Image as ImageIcon, PieChart as PieChartIcon, Edit3 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { PageLoader } from "@/components/ui/PageLoader";
import { useRole } from "@/contexts/RoleContext";
import { useWS } from "@/contexts/WebSocketContext";
import api, { API_BASE_URL } from "@/lib/api";
import { useAlert } from "@/contexts/AlertContext";


export default function CalificacionManualPage() {
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
  
  const { showAlert } = useAlert();

  // Grading state
  const [gradingGuid, setGradingGuid] = useState<string | null>(null);
  const [gradeValue, setGradeValue] = useState("");
  const [gradeComment, setGradeComment] = useState("");
  const [saving, setSaving] = useState(false);

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
        setEntregas(data.filter(e => !(e.tarea_titulo?.startsWith('[QUIZ]'))));
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

  const handleGradeChange = (val: string) => {
    let cleanVal = val.replace(/[^0-9.]/g, '');
    const parts = cleanVal.split('.');
    if (parts.length > 2) cleanVal = parts[0] + '.' + parts.slice(1).join('');

    if (cleanVal === '') {
      setGradeValue('');
      return;
    }

    let num = parseFloat(cleanVal);
    if (num > 5) cleanVal = '5.0';

    if (cleanVal.length === 1 && /^[0-4]$/.test(cleanVal) && gradeValue.length < cleanVal.length) {
      cleanVal += '.';
    } else if (cleanVal === '5' && gradeValue.length < cleanVal.length) {
      cleanVal = '5.0';
    }

    if (cleanVal.includes('.')) {
      const dec = cleanVal.split('.')[1];
      if (dec && dec.length > 1) {
        cleanVal = cleanVal.split('.')[0] + '.' + dec.substring(0, 1);
      }
    }

    setGradeValue(cleanVal);
  };

  const handleCalificar = async (guid: string) => {
    const nota = parseFloat(gradeValue);
    if (isNaN(nota) || nota < 0 || nota > 5) {
      showAlert.warning("Atención", "La calificación debe ser un número entre 0 y 5.");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/cursos/entregas/${guid}/calificar`, { calificacion: nota, comentario: gradeComment || undefined });
      setEntregas(prev =>
        prev.map(e =>
          e.guid === guid
            ? { ...e, estado: "CALIFICADA", contenido_texto: `NOTA: ${nota}${gradeComment ? ` | ${gradeComment}` : ''}` }
            : e
        )
      );
      setGradingGuid(null);
      setGradeValue("");
      setGradeComment("");
    } catch (err) {
      console.error(err);
      showAlert.error("Error", "Error al calificar.");
    } finally {
      setSaving(false);
    }
  };



  const cursosAgrupados = useMemo(() => {
    const map = new Map<string, { guid: string; titulo: string; imagen_portada: string | null; total: number; pending: number; graded: number; entregas: any[] }>();
    
    // Registrar todos los cursos asignados para que aparezcan aunque no tengan entregas
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
          imagen_portada: null, // Si un estudiante envía de un curso desasignado
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

  // View 2 variables (moved above early returns to obey Hook rules)
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
        if (val === undefined) {
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

  if (!selectedCourseGuid && !loading) {
    if (cursosAgrupados.length === 0) {
      return (
        <div className="animate-in fade-in duration-700">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <BookCheck className="h-8 w-8 text-primary" />
              Calificación Manual
            </h1>
            <p className="text-muted-foreground mt-2">
              Selecciona un curso para ver y calificar las entregas de los estudiantes.
            </p>
          </header>
          <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center shadow-sm">
            <BookCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-lg font-bold">No hay cursos asignados</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Actualmente no tienes cursos asignados para calificar.
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
          { name: "Pendientes", value: totalPendingGlobal, color: "#f59e0b" },
          { name: "Calificadas", value: totalGradedGlobal, color: "#10b981" }
        ].filter(d => d.value > 0)
      : [
          { name: "Sin entregas", value: 1, color: "#94a3b8" }
        ];

    const courseBarData = cursosAgrupados
      .filter(c => c.total > 0)
      .map(c => ({
        name: c.titulo.length > 15 ? c.titulo.substring(0, 15) + '...' : c.titulo,
        Pendientes: c.pending,
        Calificadas: c.graded,
        guid: c.guid
      }));

    return (
      <div className="animate-in fade-in duration-700">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BookCheck className="h-8 w-8 text-primary" />
            Calificación Manual
          </h1>
          <p className="text-muted-foreground mt-2">
            Selecciona un curso para ver y calificar las entregas de los estudiantes.
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
            <p className="text-xs text-muted-foreground font-medium">Total Entregas</p>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Star className="h-4 w-4 text-amber-500" />
              </div>
              <span className="text-2xl font-bold">{totalPendingGlobal}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Pendientes Globales</p>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Check className="h-4 w-4 text-emerald-500" />
              </div>
              <span className="text-2xl font-bold">{totalGradedGlobal}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Calificadas Globales</p>
          </div>
        </div>

        {/* Global Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                <PieChartIcon className="h-5 w-5 text-primary" />
                Estado Global de Entregas
              </h3>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={globalPieData}
                      cx="40%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="var(--card)"
                      strokeWidth={3}
                    >
                      {globalPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />
                      ))}
                    </Pie>
                    <Legend 
                      verticalAlign="middle" 
                      align="right" 
                      layout="vertical" 
                      iconType="circle"
                      wrapperStyle={{ fontSize: '12px', paddingLeft: '20px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                <BarChart3 className="h-5 w-5 text-primary" />
                Cursos con más actividad
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} dy={5} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} dx={-5} />
                      <RechartsTooltip 
                        cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                        contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'var(--card)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="Pendientes" fill="#f59e0b" radius={[4, 4, 4, 4]} maxBarSize={10} />
                      <Bar dataKey="Calificadas" fill="#10b981" radius={[4, 4, 4, 4]} maxBarSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No hay entregas en los cursos asignados.
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
            <BookCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
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
                  {/* Make the title area clickable to go to details */}
                  <div className="cursor-pointer group flex-1" onClick={() => setSelectedCourseGuid(curso.guid)}>
                    <h3 className="font-bold text-lg mb-4 group-hover:text-primary transition-colors line-clamp-2 pr-8">
                      {curso.titulo}
                    </h3>
                  </div>
                  
                  {/* Arrow icon that goes to course grading */}
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
                        <span className="text-muted-foreground">Pendientes</span>
                        <span className="font-bold text-amber-500">{curso.pending}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Calificadas</span>
                        <span className="font-bold text-emerald-500">{curso.graded}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full" 
                          style={{ width: `${(curso.graded / curso.total) * 100}%` }}
                        />
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
  const coursePieData = selectedCourse && selectedCourse.total > 0 
    ? [
        { name: "Pendientes", value: selectedCourse.pending, color: "#f59e0b" },
        { name: "Calificadas", value: selectedCourse.graded, color: "#10b981" }
      ].filter(d => d.value > 0)
    : [
        { name: "Sin entregas", value: 1, color: "#94a3b8" }
      ];

  const filtered = (selectedCourse?.entregas || []).filter(e => {
    const q = search.toLowerCase();
    const matchesSearch =
      e.estudiante?.nombre?.toLowerCase().includes(q) ||
      e.estudiante?.apellido?.toLowerCase().includes(q) ||
      e.tarea_titulo?.toLowerCase().includes(q);
    
    if (filter === "pending") return matchesSearch && e.estado !== "CALIFICADA";
    if (filter === "graded") return matchesSearch && e.estado === "CALIFICADA";
    return matchesSearch;
  });

  if (loading) {
    return <PageLoader message="Cargando entregas para calificar..." />;
  }

  return (
    <div className="animate-in slide-in-from-right-4 duration-500">
      <button 
        onClick={() => { setSelectedCourseGuid(null); setSearch(""); setFilter("all"); setGradingGuid(null); }}
        className="mb-6 flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a cursos
      </button>

      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3 mb-6">
          <BookCheck className="h-6 w-6 text-primary" />
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
            <p className="text-xs text-muted-foreground font-medium">Total Entregas</p>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Star className="h-4 w-4 text-amber-500" />
              </div>
              <span className="text-2xl font-bold">{selectedCourse?.pending}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Pendientes por Calificar</p>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Check className="h-4 w-4 text-emerald-500" />
              </div>
              <span className="text-2xl font-bold">{selectedCourse?.graded}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Calificadas</p>
          </div>
        </div>
      </header>

      {/* Course Specific Charts */}
      {selectedCourse && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
              <PieChartIcon className="h-5 w-5 text-primary" />
              Progreso de Calificación
            </h3>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={coursePieData}
                    cx="40%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="var(--card)"
                    strokeWidth={3}
                  >
                    {coursePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />
                    ))}
                  </Pie>
                  <Legend 
                    verticalAlign="middle" 
                    align="right" 
                    layout="vertical" 
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px', paddingLeft: '20px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
              <TrendingUp className="h-5 w-5 text-primary" />
              Distribución de Notas (Calificadas)
            </h3>
            <div className="h-[180px] w-full">
              {gradeDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeDistribution} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={100} dx={-5} />
                    <RechartsTooltip 
                      cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                      contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'var(--card)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="count" name="Estudiantes" radius={[0, 4, 4, 0]} maxBarSize={12}>
                      {gradeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                  <Star className="h-8 w-8 opacity-20" />
                  <span>Aún no hay calificaciones para mostrar.</span>
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
            placeholder="Buscar por estudiante o tarea..."
            className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
          />
        </div>
        <div className="relative w-full sm:w-[200px]">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="w-full bg-card border border-border rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium shadow-sm appearance-none"
          >
            <option value="all">Todas las entregas</option>
            <option value="pending">Pendientes</option>
            <option value="graded">Calificadas</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Entregas List */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-bold">Sin resultados</h3>
          <p className="text-muted-foreground text-sm mt-1">
            No se encontraron entregas que coincidan con los filtros en este curso.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entrega => {
            const isGrading = gradingGuid === entrega.guid;
            const isCalificada = entrega.estado === "CALIFICADA";
            const nota = entrega.contenido_texto?.startsWith("NOTA:") 
              ? entrega.contenido_texto.replace("NOTA: ", "").split(" | ")[0]
              : null;
            const comentario = entrega.contenido_texto?.includes(" | ")
              ? entrega.contenido_texto.split(" | ").slice(1).join(" | ")
              : null;

            return (
              <div
                key={entrega.guid}
                className={`bg-card border rounded-2xl overflow-hidden shadow-sm transition-all ${
                  isCalificada ? "border-emerald-500/30" : "border-border/50 hover:border-primary/50"
                }`}
              >
                <div className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isCalificada ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                      }`}>
                        {isCalificada ? "Calificada" : "Pendiente"}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm truncate">{entrega.tarea_titulo}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Estudiante: <span className="font-semibold text-foreground">{entrega.estudiante?.nombre} {entrega.estudiante?.apellido}</span>
                      <span className="mx-2">•</span>
                      {entrega.fecha_entrega
                        ? new Date(entrega.fecha_entrega).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                        : "Sin fecha"}
                    </p>
                  </div>

                  {/* Center: File download */}
                  {entrega.archivo_servidor && (
                    <a
                      href={`${API_BASE_URL}/cursos/download/${entrega.archivo_servidor}?originalName=${encodeURIComponent(entrega.archivo_nombre || 'archivo')}`}
                      className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-colors shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {entrega.archivo_nombre || "Descargar"}
                    </a>
                  )}

                  {/* Right: Grade actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isCalificada && nota ? (
                      <div className="flex items-center gap-2">
                        <div className="bg-emerald-500/10 px-4 py-2 rounded-xl">
                          <span className="text-lg font-bold text-emerald-600">{nota}</span>
                          <span className="text-xs text-emerald-600/70 ml-1">/5.0</span>
                        </div>
                        {comentario && (
                          <div className="text-xs text-muted-foreground max-w-[150px] truncate flex items-center gap-1" title={comentario}>
                            <MessageSquare className="h-3 w-3 shrink-0" /> {comentario}
                          </div>
                        )}
                        {!isGrading && (
                          <button
                            onClick={() => { setGradingGuid(entrega.guid); setGradeValue(nota.toString()); setGradeComment(comentario || ""); }}
                            className="p-2 ml-2 bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-xl transition-colors shadow-sm"
                            title="Editar Calificación"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ) : !isGrading ? (
                      <button
                        onClick={() => { setGradingGuid(entrega.guid); setGradeValue(""); setGradeComment(""); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 shadow-sm"
                      >
                        <Star className="h-3.5 w-3.5" /> Calificar
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Grading Panel */}
                {isGrading && (
                  <div className="px-5 pb-5 pt-0 animate-in slide-in-from-top-2 duration-200">
                    <div className="bg-muted/30 border border-border/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-end gap-4">
                      <div className="flex-shrink-0">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          Nota (0-5)
                        </label>
                        <input
                          type="text"
                          value={gradeValue}
                          onChange={(e) => handleGradeChange(e.target.value)}
                          className="w-24 bg-background border border-border rounded-lg px-3 py-2 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          placeholder="0.0"
                          autoFocus
                        />
                      </div>
                      <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          Comentario (opcional)
                        </label>
                        <input
                          type="text"
                          value={gradeComment}
                          onChange={(e) => setGradeComment(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          placeholder="Retroalimentación para el estudiante..."
                        />
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleCalificar(entrega.guid)}
                          disabled={saving}
                          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Guardar Nota
                        </button>
                        <button
                          onClick={() => setGradingGuid(null)}
                          className="p-2.5 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
                        >
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
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
