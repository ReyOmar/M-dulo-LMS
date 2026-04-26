"use client";

import { useEffect, useState } from "react";
import { BookCheck, Download, Loader2, Check, Search, FileText, Star, MessageSquare, X, Filter } from "lucide-react";
import { PageLoader } from "@/components/PageLoader";
import { useRole } from "@/contexts/RoleContext";

export default function CalificacionManualPage() {
  const { user } = useRole();
  const [entregas, setEntregas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "graded">("all");

  // Grading state
  const [gradingGuid, setGradingGuid] = useState<string | null>(null);
  const [gradeValue, setGradeValue] = useState("");
  const [gradeComment, setGradeComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.guid) fetchEntregas();
  }, [user?.guid]);

  const fetchEntregas = async () => {
    try {
      const res = await fetch(`http://localhost:3200/api/cursos/examiner/entregas?profesor_guid=${user?.guid}`);
      const data = await res.json();
      setEntregas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCalificar = async (guid: string) => {
    const nota = parseFloat(gradeValue);
    if (isNaN(nota) || nota < 0 || nota > 5) {
      alert("La calificación debe ser un número entre 0 y 5.");
      return;
    }
    setSaving(true);
    try {
      await fetch(`http://localhost:3200/api/cursos/entregas/${guid}/calificar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calificacion: nota, comentario: gradeComment || undefined }),
      });
      // Update local state
      setEntregas(prev =>
        prev.map(e =>
          e.guid === guid
            ? { ...e, estado: "CALIFICADA", calificacion: nota, comentario: gradeComment }
            : e
        )
      );
      setGradingGuid(null);
      setGradeValue("");
      setGradeComment("");
    } catch (err) {
      console.error(err);
      alert("Error al calificar.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = entregas.filter(e => {
    const q = search.toLowerCase();
    const matchesSearch =
      e.estudiante?.nombre?.toLowerCase().includes(q) ||
      e.estudiante?.apellido?.toLowerCase().includes(q) ||
      e.tarea_titulo?.toLowerCase().includes(q) ||
      e.curso_titulo?.toLowerCase().includes(q);
    
    if (filter === "pending") return matchesSearch && e.estado !== "CALIFICADA";
    if (filter === "graded") return matchesSearch && e.estado === "CALIFICADA";
    return matchesSearch;
  });

  const pendingCount = entregas.filter(e => e.estado !== "CALIFICADA").length;
  const gradedCount = entregas.filter(e => e.estado === "CALIFICADA").length;

  if (loading) {
    return <PageLoader message="Cargando entregas para calificar..." />;
  }

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BookCheck className="h-8 w-8 text-primary" />
          Calificación Manual
        </h1>
        <p className="text-muted-foreground mt-2">
          Revisa los archivos entregados por tus estudiantes y asigna calificaciones.
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-2xl font-bold">{entregas.length}</span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Total Entregas</p>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Star className="h-4 w-4 text-amber-500" />
            </div>
            <span className="text-2xl font-bold">{pendingCount}</span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Pendientes por Calificar</p>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Check className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-2xl font-bold">{gradedCount}</span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Calificadas</p>
        </div>
      </div>

      {/* Search + Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por estudiante, tarea o curso..."
            className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "pending", "graded"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                filter === f
                  ? "bg-primary text-white shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f === "all" ? "Todas" : f === "pending" ? "Pendientes" : "Calificadas"}
            </button>
          ))}
        </div>
      </div>

      {/* Entregas List */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center">
          <BookCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-bold">Sin entregas</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {search ? "No se encontraron entregas con ese criterio." : "No hay entregas de estudiantes pendientes."}
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
                  isCalificada ? "border-emerald-500/30" : "border-border/50"
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
                      <span className="text-xs text-muted-foreground">{entrega.curso_titulo}</span>
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
                      href={`http://localhost:3200/api/cursos/download/${entrega.archivo_servidor}`}
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
                          type="number"
                          min={0}
                          max={5}
                          step={0.1}
                          value={gradeValue}
                          onChange={(e) => setGradeValue(e.target.value)}
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
