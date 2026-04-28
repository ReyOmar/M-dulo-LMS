"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, FileText, UploadCloud, File as FileIcon, Loader2, ChevronRight, Users, Clock, CheckCircle2, Edit3, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useRole } from "@/contexts/RoleContext";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export default function TareaVisorPage() {
  const { curso_id, tarea_id } = useParams();
  const { role } = useRole();
  const router = useRouter();

  const [curso, setCurso] = useState<any>(null);
  const [tarea, setTarea] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Student upload states
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Examiner: list of submissions
  const [entregas, setEntregas] = useState<any[]>([]);
  const [showEntregas, setShowEntregas] = useState(false);
  const [loadingEntregas, setLoadingEntregas] = useState(false);

  const isTeacher = role === 'teacher';

  useEffect(() => {
    if (curso_id) fetchCurso();
  }, [curso_id]);

  // Auto-load submissions count for examiner
  useEffect(() => {
    if (isTeacher && tarea_id) fetchEntregas();
  }, [isTeacher, tarea_id]);

  const fetchCurso = async () => {
    try {
      const res = await api.get(`/cursos/${curso_id}`);
      const data = res.data;
      setCurso(data);

      let foundTarea = null;
      for (const mod of data.modulos || []) {
          for (const lec of mod.lecciones || []) {
              const rec = lec.recursos?.find((r: any) => r.guid === tarea_id);
              if (rec) { foundTarea = rec; break; }
          }
          if (foundTarea) break;
      }
      setTarea(foundTarea);

      // Student: load previous submission
      if (!isTeacher) {
          try {
              const { data: entregaData } = await api.get(`/cursos/tareas/${tarea_id}/entregas/mine`);
              if (entregaData?.respuesta_texto) {
                  setSelectedFileName(entregaData.respuesta_texto);
                  setUploadState('done');
              }
          } catch (_) {}
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEntregas = async () => {
    setLoadingEntregas(true);
    try {
        const res = await api.get(`/cursos/tareas/${tarea_id}/todas-entregas`);
        const data = res.data;
        // Guard: ensure we always store an array
        setEntregas(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); setEntregas([]); }
    finally { setLoadingEntregas(false); }
  };

  const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
  });

  const processFile = async (file: File) => {
      if (file.size > 5 * 1024 * 1024) { alert('El archivo excede el tamaño máximo permitido de 5 MB.'); return; }
      try {
          setUploadState('uploading');
          const base64 = await toBase64(file);
          await api.post(`/cursos/tareas/${tarea_id}/entregas`, { base64, nombre_archivo: file.name });
          setSelectedFileName(file.name);
          setUploadState('done');
      } catch (err) { console.error(err); alert('Hubo un error al enviar tu archivo.'); setUploadState('idle'); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) processFile(e.target.files[0]);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault(); setIsDragging(false);
      if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-muted-foreground">Cargando actividad...</div>;

  if (!tarea) return (
    <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">Actividad no encontrada</h1>
        <Link href={`/cursos/${curso_id}`} className="mt-4 text-primary font-bold">Volver al curso</Link>
    </div>
  );

  const isQuiz = tarea.titulo.startsWith('[QUIZ]');
  const cleanTitle = isQuiz ? tarea.titulo.replace('[QUIZ] ', '') : tarea.titulo;

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50 h-16 flex items-center px-6">
          <Link href={`/cursos/${curso_id}`} className="p-2 hover:bg-muted rounded-full transition-colors mr-4">
              <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center text-sm font-semibold text-muted-foreground truncate flex-1">
              {curso?.titulo} <ChevronRight className="h-4 w-4 mx-2" /> <span className="text-foreground">{cleanTitle}</span>
          </div>
          {isTeacher && (
              <span className="ml-4 text-xs font-bold px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full">Modo Examinador</span>
          )}
      </header>

      <main className="max-w-[95%] xl:max-w-[90%] mx-auto py-12 px-6 animate-in fade-in duration-700">

        <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4">{cleanTitle}</h1>
            <div className="flex gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold">
                    <Check className="h-3 w-3" /> Hecho: Ver
                </span>
                {!isTeacher && (
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${uploadState === 'done' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                        {uploadState === 'done' && <Check className="h-3 w-3" />} Hecho: Hacer un envío
                    </span>
                )}
                {isTeacher && (
                    <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 px-3 py-1 rounded-full text-xs font-bold">
                        <Users className="h-3 w-3" /> Vista de Examinador
                    </span>
                )}
            </div>
        </div>

        {/* Activity content box */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden mb-12">
            <div className="p-8 prose prose-slate dark:prose-invert max-w-none">
                {tarea.contenido_html ? (
                    <div dangerouslySetInnerHTML={{ __html: tarea.contenido_html }} />
                ) : (
                    <p className="text-muted-foreground italic">
                       El creador de la actividad no proporcionó una descripción adicional.
                    </p>
                )}
            </div>

            {/* ---- EXAMINER PANEL ---- */}
            {isTeacher ? (
                <div className="bg-amber-500/5 border-t border-amber-500/20 p-6 flex flex-col items-center gap-4">
                    <p className="text-sm text-amber-700 dark:text-amber-400 font-semibold text-center">
                        Como examinador puedes {isQuiz ? 'revisar las notas de los intentos' : 'ver todas las entregas realizadas por los estudiantes'}.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                            onClick={async () => {
                                if (!showEntregas) await fetchEntregas();
                                setShowEntregas(v => !v);
                            }}
                            className="flex items-center gap-2 font-bold px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-sm hover:scale-105"
                        >
                            {loadingEntregas
                                ? <><Loader2 className="h-5 w-5 animate-spin" /> Cargando...</>
                                : isQuiz
                                    ? <><ClipboardList className="h-5 w-5" /> {showEntregas ? 'Ocultar notas' : 'Revisar notas'}</>
                                    : <><Users className="h-5 w-5" /> {showEntregas ? 'Ocultar entregas' : 'Revisar entregas'}</>
                            }
                        </button>
                        <button
                            onClick={() => router.push(`/dashboard/constructor-cursos/${curso_id}/tareas/${tarea_id}`)}
                            className="flex items-center gap-2 font-bold px-6 py-3 rounded-xl bg-card border border-border hover:bg-muted text-foreground transition-all shadow-sm hover:scale-105"
                        >
                            <Edit3 className="h-5 w-5 text-primary" /> {isQuiz ? 'Editar Cuestionario' : 'Editar Tarea'}
                        </button>
                    </div>
                </div>
            ) : (
            /* ---- STUDENT PANEL ---- */
                <div
                    className={`transition-colors border-t border-border/50 p-6 flex justify-center flex-col items-center gap-4 ${isDragging ? 'bg-primary/10 border-dashed border-2 border-primary' : 'bg-muted/30'}`}
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                >
                    <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                    {isQuiz && (
                        <div className="text-sm font-semibold text-muted-foreground bg-card px-4 py-2 rounded-lg border border-border shadow-sm mb-2">
                            Intentos permitidos: <span className="font-bold text-foreground">1</span>
                        </div>
                    )}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadState === 'uploading' || isQuiz}
                      className={`relative overflow-hidden flex items-center gap-2 font-bold px-8 py-3 rounded-xl transition-all shadow-sm
                        ${uploadState === 'idle' && !isQuiz ? 'bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105 hover:-translate-y-1' :
                          uploadState === 'idle' && isQuiz ? 'bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600' :
                          uploadState === 'uploading' ? 'bg-muted text-muted-foreground cursor-not-allowed' :
                          'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                    >
                        {uploadState === 'idle' && (isQuiz ? <><Check className="h-5 w-5" /> Intentar cuestionario</> : <><UploadCloud className="h-5 w-5" /> Agregar entrega (Subir Archivo)</>)}
                        {uploadState === 'uploading' && <><Loader2 className="h-5 w-5 animate-spin" /> Subiendo archivo ({selectedFileName})...</>}
                        {uploadState === 'done' && <><UploadCloud className="h-5 w-5" /> Subir archivo diferente</>}
                    </button>
                    {!isQuiz && (
                        <p className="text-xs text-muted-foreground font-medium mt-2">
                            Haz clic o arrastra un archivo aquí (Tamaño máx: 5MB)
                        </p>
                    )}
                </div>
            )}
        </div>

        {/* ---- EXAMINER: Summary info table ---- */}
        {isTeacher && (
            <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">{isQuiz ? 'Resumen del Cuestionario' : 'Resumen de la Actividad'}</h2>
                <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden text-sm">
                    <table className="w-full text-left">
                        <tbody className="divide-y divide-border">
                            <tr className="divide-x divide-border">
                                <td className="p-4 w-1/3 font-semibold text-muted-foreground bg-muted/10">
                                    {isQuiz ? 'Intentos permitidos' : 'Fecha límite de entrega'}
                                </td>
                                <td className="p-4 text-foreground">
                                    {isQuiz
                                        ? '1 intento'
                                        : tarea.url_archivo
                                            ? new Date(tarea.url_archivo).toLocaleString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                            : 'Sin fecha definida'}
                                </td>
                            </tr>
                            <tr className="divide-x divide-border">
                                <td className="p-4 font-semibold text-muted-foreground bg-muted/10">
                                    {isQuiz ? 'Notas / Intentos registrados' : 'Entregas realizadas'}
                                </td>
                                <td className="p-4">
                                    {loadingEntregas ? (
                                        <span className="text-muted-foreground italic">Cargando…</span>
                                    ) : (
                                        <span className={`font-bold text-lg ${entregas.length > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                            {entregas.length} <span className="text-sm font-normal text-muted-foreground">{isQuiz ? 'intento(s)' : 'entrega(s)'}</span>
                                        </span>
                                    )}
                                </td>
                            </tr>
                            <tr className="divide-x divide-border">
                                <td className="p-4 font-semibold text-muted-foreground bg-muted/10">Total de estudiantes</td>
                                <td className="p-4 text-muted-foreground italic">No disponible (sin matrícula conectada)</td>
                            </tr>
                            <tr className="divide-x divide-border">
                                <td className="p-4 font-semibold text-muted-foreground bg-muted/10">Pendientes por entregar</td>
                                <td className="p-4">
                                    {loadingEntregas ? (
                                        <span className="text-muted-foreground italic">Cargando…</span>
                                    ) : entregas.length === 0 ? (
                                        <span className="text-amber-600 font-semibold">Sin entregas registradas</span>
                                    ) : (
                                        <span className="text-amber-600 font-semibold">
                                            {entregas.length} {isQuiz ? 'intentos recibidos' : 'entregas recibidas'}, sin datos de matrícula para calcular pendientes
                                        </span>
                                    )}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* ---- EXAMINER: Expandable Entregas/Notas Table ---- */}
        {isTeacher && showEntregas && (
            <div className="mb-12 animate-in slide-in-from-top-4 duration-300">
                <h2 className="text-2xl font-bold mb-4">{isQuiz ? 'Notas e Intentos' : 'Entregas Recibidas'}</h2>
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    {entregas.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground italic">
                            No hay entregas aún para esta actividad.
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="border-b border-border bg-muted/30">
                                <tr>
                                    <th className="p-4 font-bold text-muted-foreground uppercase text-xs">Estudiante (ID)</th>
                                    <th className="p-4 font-bold text-muted-foreground uppercase text-xs">Archivo entregado</th>
                                    <th className="p-4 font-bold text-muted-foreground uppercase text-xs">Fecha entrega</th>
                                    <th className="p-4 font-bold text-muted-foreground uppercase text-xs">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {entregas.map((e: any) => (
                                    <tr key={e.guid} className="hover:bg-muted/20 transition-colors">
                                        <td className="p-4 font-mono text-xs text-muted-foreground">{e.usuario_guid}</td>
                                        <td className="p-4">
                                            {e.respuesta_texto ? (
                                                <div className="flex items-center gap-2 text-primary font-semibold">
                                                    <FileIcon className="h-4 w-4 flex-shrink-0" />
                                                    <span className="truncate max-w-[200px]">{e.respuesta_texto}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground italic">Sin archivo</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-muted-foreground text-xs">
                                            {e.fecha_entrega
                                                ? new Date(e.fecha_entrega).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                                : '—'}
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                                                e.estado === 'ENTREGADA'
                                                    ? 'bg-emerald-500/10 text-emerald-600'
                                                    : 'bg-amber-500/10 text-amber-600'
                                            }`}>
                                                {e.estado === 'ENTREGADA' && <CheckCircle2 className="h-3 w-3" />}
                                                {e.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        )}

        {/* ---- STUDENT: Status Table ---- */}
        {!isTeacher && (
            <>
                <h2 className="text-2xl font-bold mb-6">Estado de la entrega</h2>
                <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden text-sm">
                    <table className="w-full text-left">
                        <tbody className="divide-y divide-border">
                            <tr className="divide-x divide-border">
                                <td className="p-4 w-1/4 sm:w-1/3 font-semibold text-muted-foreground bg-muted/10">Estado de la entrega</td>
                                <td className={`p-4 ${uploadState === 'done' ? 'bg-emerald-500/10 font-bold text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>
                                    {uploadState === 'done' ? 'Enviado para calificar' : 'No entregado'}
                                </td>
                            </tr>
                            <tr className="divide-x divide-border">
                                <td className="p-4 font-semibold text-muted-foreground bg-muted/10">Estado de la calificación</td>
                                <td className="p-4 text-foreground">{uploadState === 'done' ? 'Sin calificar' : 'No calificado'}</td>
                            </tr>
                            <tr className="divide-x divide-border">
                                <td className="p-4 font-semibold text-muted-foreground bg-muted/10">Fecha de entrega (Límite)</td>
                                <td className="p-4 text-foreground">
                                    {tarea.url_archivo
                                        ? new Date(tarea.url_archivo).toLocaleString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                        : 'Sin fecha definida'}
                                </td>
                            </tr>
                            <tr className="divide-x divide-border">
                                <td className="p-4 font-semibold text-muted-foreground bg-muted/10">Archivo entregado</td>
                                <td className="p-4">
                                    {uploadState === 'done' && selectedFileName ? (
                                        <div className="flex items-center gap-2 text-primary font-semibold">
                                            <FileIcon className="h-4 w-4" /> {selectedFileName}
                                            <span className="text-xs text-muted-foreground font-normal ml-4">Subido recientemente</span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground italic">Ningún archivo ha sido enviado</span>
                                    )}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </>
        )}

      </main>
    </div>
  );
}
