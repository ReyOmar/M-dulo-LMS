"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, FileText, Type, CheckCircle, Trophy, Lock, PlayCircle, Paperclip, UploadCloud, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { PageLoader } from "@/components/ui/PageLoader";
import Link from "next/link";
import api, { API_BASE_URL } from "@/lib/api";
import { useWS } from "@/contexts/WebSocketContext";
import QuizPlayer from "@/components/quiz/QuizPlayer";
import AssignmentPlayer from "@/components/tareas/AssignmentPlayer";

export default function CursoVisorPage() {
  const { curso_id } = useParams();
  const router = useRouter();
  const [curso, setCurso] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completados, setCompletados] = useState<string[]>([]);
  const [selectedRecurso, setSelectedRecurso] = useState<any>(null);
  const [selectedModuloGuid, setSelectedModuloGuid] = useState<string>('');
  const [userGuid, setUserGuid] = useState<string>('');
  const [progresoLoaded, setProgresoLoaded] = useState(false);
  const [inMaintenance, setInMaintenance] = useState(false);
  const { subscribe, maintenanceCourses } = useWS();

  useEffect(() => {
    const savedUser = localStorage.getItem("lms_user");
    if (savedUser) {
      try { setUserGuid(JSON.parse(savedUser).guid); } catch {}
    }
  }, []);

  useEffect(() => {
    if (!curso_id) return;
    
    fetchCurso();

    const unsub1 = subscribe('course:updated', fetchCurso);
    const unsub2 = subscribe('dashboard:refresh', fetchCurso);
    
    return () => {
      unsub1();
      unsub2();
    };
  }, [curso_id, subscribe]);

  useEffect(() => {
    if (!curso_id || !userGuid) return;
    
    fetchProgreso();

    const unsub1 = subscribe('submission:graded', fetchProgreso);
    const unsub2 = subscribe('dashboard:refresh', fetchProgreso);
    
    return () => {
      unsub1();
      unsub2();
    };
  }, [curso_id, userGuid, subscribe]);

  useEffect(() => {
    import('@justinribeiro/lite-youtube').catch(console.error);
  }, []);

  // Listen for maintenance events on this specific course
  useEffect(() => {
    if (maintenanceCourses[curso_id as string]) {
      setInMaintenance(true);
    }
  }, [maintenanceCourses, curso_id]);

  useEffect(() => {
    const unsub = subscribe('course:maintenance', (data: any) => {
      if (data.curso_guid === curso_id) {
        setInMaintenance(true);
      }
    });
    return unsub;
  }, [subscribe, curso_id]);

  const fetchCurso = async () => {
    try {
      const res = await api.get(`/cursos/${curso_id}`);
      const data = res.data;
      setCurso(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgreso = async () => {
    try {
      const res = await api.get(`/cursos/student/progreso?usuario_guid=${userGuid}&curso_guid=${curso_id}`);
      const data = res.data;
      setCompletados(data.completados || []);
    } catch (err) {
      console.error(err);
    } finally {
      setProgresoLoaded(true);
    }
  };

  const marcarCompletado = useCallback(async (recurso_guid: string) => {
    if (!userGuid || completados.includes(recurso_guid)) return;
    try {
      await api.post(`/cursos/student/completar-recurso?usuario_guid=${userGuid}`, { recurso_guid });
      setCompletados(prev => [...prev, recurso_guid]);
    } catch (err) {
      console.error(err);
    }
  }, [userGuid, completados]);




  // Helper to ensure URLs are absolute
  const ensureAbsoluteUrl = (url: string) => {
    if (!url) return url;
    if (/^https?:\/\//i.test(url) || url.startsWith('//')) return url;
    return `https://${url}`;
  };

  const modulos = curso?.modulos || [];

  // --- UNLOCK LOGIC ---
  // For each module, check if ALL resources in the PREVIOUS module are completed
  const isModuloUnlocked = (moduleIndex: number): boolean => {
    if (moduleIndex === 0) return true; // First module always unlocked
    const prevModulo = modulos[moduleIndex - 1];
    const prevRecursos = prevModulo?.lecciones?.[0]?.recursos || [];
    if (prevRecursos.length === 0) return true; // Empty module = unlocked
    return prevRecursos.every((r: any) => completados.includes(r.guid));
  };

  // For each resource inside a module, check if ALL previous resources in same module are completed
  const isRecursoUnlocked = (moduleIndex: number, resourceIndex: number): boolean => {
    if (!isModuloUnlocked(moduleIndex)) return false;
    if (resourceIndex === 0) return true; // First resource in module always unlocked (if module is unlocked)
    const recursos = modulos[moduleIndex]?.lecciones?.[0]?.recursos || [];
    for (let i = 0; i < resourceIndex; i++) {
      if (!completados.includes(recursos[i].guid)) return false;
    }
    return true;
  };

  const isRecursoCompleted = (guid: string) => completados.includes(guid);

  const handleSelectRecurso = (recurso: any, moduloGuid: string, moduleIndex: number, resourceIndex: number) => {
    if (!isRecursoUnlocked(moduleIndex, resourceIndex)) return;
    setSelectedRecurso(recurso);
    setSelectedModuloGuid(moduloGuid);

    // Auto-mark TEXT and ENLACE as completed on view
    if ((recurso.tipo === 'TEXTO' || recurso.tipo === 'ENLACE') && !isRecursoCompleted(recurso.guid)) {
      marcarCompletado(recurso.guid);
    }
  };

  // Auto-select first uncompleted resource (Retomar Curso)
  useEffect(() => {
    if (curso && progresoLoaded && !selectedRecurso) {
      const modulosList = curso.modulos || [];
      let targetRecurso = null;
      let targetModuloGuid = '';
      let targetModIdx = -1;
      let targetRecIdx = -1;

      for (let m = 0; m < modulosList.length; m++) {
        if (!isModuloUnlocked(m)) break;
        const recursos = modulosList[m]?.lecciones?.[0]?.recursos || [];
        for (let r = 0; r < recursos.length; r++) {
          if (!completados.includes(recursos[r].guid)) {
            // Found first uncompleted resource
            targetRecurso = recursos[r];
            targetModuloGuid = modulosList[m].guid;
            targetModIdx = m;
            targetRecIdx = r;
            break;
          }
        }
        if (targetRecurso) break;
      }

      // If all are completed, select the very last resource
      if (!targetRecurso && modulosList.length > 0) {
        const lastMod = modulosList[modulosList.length - 1];
        const lastRecursos = lastMod?.lecciones?.[0]?.recursos || [];
        if (lastRecursos.length > 0) {
          targetRecurso = lastRecursos[lastRecursos.length - 1];
          targetModuloGuid = lastMod.guid;
          targetModIdx = modulosList.length - 1;
          targetRecIdx = lastRecursos.length - 1;
        }
      }

      if (targetRecurso) {
        // Bypass the wrapper to avoid triggering complete immediately if not wanted,
        // but handleSelectRecurso handles the marking anyway, which is fine.
        handleSelectRecurso(targetRecurso, targetModuloGuid, targetModIdx, targetRecIdx);
      }
    }
  }, [curso, progresoLoaded, selectedRecurso, completados]);

  const getRecursoIcon = (recurso: any, completed: boolean, locked: boolean) => {
    if (locked) return <Lock className="h-4 w-4 text-muted-foreground/50" />;
    if (recurso.tipo === 'TEXTO') return <Type className={`h-4 w-4 ${completed ? 'text-emerald-500' : ''}`} />;
    if (recurso.tipo === 'ENLACE') return <PlayCircle className={`h-4 w-4 ${completed ? 'text-emerald-500' : 'text-pink-500'}`} />;
    if (recurso.tipo === 'TAREA' && recurso.titulo?.startsWith('[QUIZ]')) return <CheckCircle className={`h-4 w-4 ${completed ? 'text-emerald-500' : 'text-amber-500'}`} />;
    if (recurso.tipo === 'TAREA') return <FileText className={`h-4 w-4 ${completed ? 'text-emerald-500' : 'text-blue-500'}`} />;
    return <BookOpen className="h-4 w-4" />;
  };

  const [isQuizActive, setIsQuizActive] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isQuizActive) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isQuizActive]);

  if (loading) {
    return <PageLoader message="Cargando contenido del curso..." />;
  }

  if (!curso) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">Curso no encontrado</h1>
        <Link href="/dashboard" className="mt-4 text-primary font-bold">Volver al inicio</Link>
      </div>
    );
  }

  // MAINTENANCE OVERLAY
  if (inMaintenance) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
        <div className="max-w-md w-full bg-card border border-amber-500/30 rounded-3xl p-12 text-center shadow-xl">
          <div className="w-24 h-24 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
          </div>
          <h1 className="text-3xl font-black mb-4 text-foreground tracking-tight">Curso en Mantenimiento</h1>
          <p className="text-muted-foreground mb-2 text-lg leading-relaxed">
            El administrador o examinador ha iniciado un período de mantenimiento para el curso <strong className="text-foreground">{curso.titulo}</strong>.
          </p>
          <p className="text-muted-foreground mb-10 text-sm">
            Todos los contenidos se conservan intactos. Vuelve más tarde cuando el curso sea publicado de nuevo.
          </p>
          <Link
            href="/dashboard/student/cursos"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 rounded-2xl font-bold shadow-lg transition-all hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
            Volver a Mis Cursos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navbar */}
      {!isQuizActive && (
          <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50 h-16 flex items-center px-6 shrink-0">
            <Link href="/dashboard/student/cursos" className="p-2 hover:bg-muted rounded-full transition-colors mr-4">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex-1 truncate font-bold text-lg">{curso.titulo}</div>
          </header>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar — Module & Resource List */}
        {!isQuizActive && (
            <div className="w-[320px] bg-card border-r border-border overflow-y-auto flex flex-col shrink-0">
          <div className="p-4 border-b border-border">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Temario del Curso</h2>
          </div>
          <div className="p-3 space-y-2 flex-1">
            {modulos.map((mod: any, mi: number) => {
              const unlocked = isModuloUnlocked(mi);
              const recursos = mod.lecciones?.[0]?.recursos || [];
              const allCompleted = recursos.length > 0 && recursos.every((r: any) => completados.includes(r.guid));

              return (
                <div key={mod.guid} className="rounded-xl border border-border/50 overflow-hidden">
                  {/* Module header */}
                  <div className={`flex items-center gap-2 p-3 text-sm font-bold ${!unlocked ? 'opacity-50' : allCompleted ? 'text-emerald-600' : ''}`}>
                    {!unlocked ? (
                      <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : allCompleted ? (
                      <Trophy className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <BookOpen className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <span className="truncate flex-1">{mod.titulo}</span>
                  </div>

                  {/* Resources */}
                  {unlocked && (
                    <div className="border-t border-border/30 bg-background px-2 py-1 space-y-0.5">
                      {recursos.map((r: any, ri: number) => {
                        const rUnlocked = isRecursoUnlocked(mi, ri);
                        const rCompleted = isRecursoCompleted(r.guid);
                        const isSelected = selectedRecurso?.guid === r.guid;
                        const displayTitle = r.titulo?.startsWith('[QUIZ]') ? r.titulo.replace('[QUIZ] ', '') : r.titulo;

                        return (
                          <div
                            key={r.guid}
                            onClick={() => handleSelectRecurso(r, mod.guid, mi, ri)}
                            className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors ${
                              !rUnlocked
                                ? 'opacity-40 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-primary/10 text-primary font-bold cursor-pointer'
                                  : 'hover:bg-muted cursor-pointer text-foreground'
                            }`}
                          >
                            {getRecursoIcon(r, rCompleted, !rUnlocked)}
                            <span className={`truncate flex-1 ${rCompleted ? 'italic line-through text-muted-foreground' : ''}`}>
                              {displayTitle}
                            </span>
                            {rCompleted && <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Main Content Panel */}
        <div className="flex-1 overflow-y-auto p-8">
          {!selectedRecurso ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
              <BookOpen className="h-24 w-24 mb-6" />
              <h2 className="text-xl font-bold mb-2">Selecciona un recurso</h2>
              <p className="text-center max-w-sm">Haz clic en un recurso del temario para ver su contenido aquí.</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
              {/* Resource Title */}
              <div className="mb-8 pb-6 border-b border-border">
                <span className="text-primary font-bold tracking-widest uppercase text-xs mb-2 block">
                  {selectedRecurso.tipo === 'TEXTO' ? 'LECTURA' : selectedRecurso.tipo === 'ENLACE' ? 'VIDEO' : selectedRecurso.tipo === 'TAREA' && selectedRecurso.titulo?.startsWith('[QUIZ]') ? 'CUESTIONARIO' : 'TAREA'}
                </span>
                <h2 className="text-2xl lg:text-3xl font-bold">
                  {selectedRecurso.titulo?.startsWith('[QUIZ]') ? selectedRecurso.titulo.replace('[QUIZ] ', '') : selectedRecurso.titulo}
                </h2>
              </div>

              {/* TEXTO */}
              {selectedRecurso.tipo === 'TEXTO' && (
                <div className="space-y-6">
                  <div className="prose prose-slate dark:prose-invert max-w-none bg-card rounded-2xl p-8 border border-border/50 shadow-sm" dangerouslySetInnerHTML={{ __html: selectedRecurso.contenido_html || '<p class="text-muted-foreground italic">Sin contenido.</p>' }} />
                  {selectedRecurso.url_referencia && (
                    <a href={ensureAbsoluteUrl(selectedRecurso.url_referencia)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary font-medium hover:bg-primary/10 transition-colors">
                      <ExternalLink className="h-4 w-4" /> {selectedRecurso.url_referencia}
                    </a>
                  )}
                  {selectedRecurso.archivo_adjunto && (
                    <a href={`${API_BASE_URL}/cursos/download/${selectedRecurso.archivo_adjunto}?originalName=${encodeURIComponent(selectedRecurso.archivo_adjunto_nombre)}`} className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-xl hover:bg-primary/10 transition-colors">
                      <Paperclip className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold">{selectedRecurso.archivo_adjunto_nombre || 'Archivo adjunto'}</span>
                    </a>
                  )}
                </div>
              )}

              {/* ENLACE (Video) */}
              {selectedRecurso.tipo === 'ENLACE' && (
                <div className="space-y-6">
                  {selectedRecurso.contenido_html?.includes('youtube.com/watch?v=') && (
                    <div className="w-full rounded-2xl overflow-hidden border border-border shadow-sm">
                      {/* @ts-ignore */}
                      <lite-youtube videoid={new URL(selectedRecurso.contenido_html).searchParams.get('v')}></lite-youtube>
                    </div>
                  )}
                  {selectedRecurso.contenido_html?.includes('youtu.be/') && (
                    <div className="w-full rounded-2xl overflow-hidden border border-border shadow-sm">
                      {/* @ts-ignore */}
                      <lite-youtube videoid={selectedRecurso.contenido_html.split('youtu.be/')[1].split('?')[0]}></lite-youtube>
                    </div>
                  )}
                  {!selectedRecurso.contenido_html && (
                    <div className="w-full h-64 bg-muted/20 border border-dashed border-border rounded-2xl flex items-center justify-center text-muted-foreground">
                      <PlayCircle className="h-12 w-12 opacity-30" />
                    </div>
                  )}
                </div>
              )}

              {/* TAREA */}
              {selectedRecurso.tipo === 'TAREA' && !selectedRecurso.titulo?.startsWith('[QUIZ]') && (
                <AssignmentPlayer
                  curso_id={curso_id as string}
                  recurso_guid={selectedRecurso.guid}
                  bloque_titulo={selectedRecurso.titulo}
                  instrucciones_html={selectedRecurso.contenido_html || ''}
                  archivo_adjunto={selectedRecurso.archivo_adjunto}
                  archivo_adjunto_nombre={selectedRecurso.archivo_adjunto_nombre}
                  url_referencia={selectedRecurso.url_referencia}
                  archivo_max_size_mb={selectedRecurso.archivo_max_size_mb ?? 5}
                  onFinish={() => fetchProgreso()}
                />
              )}

              {/* QUIZ */}
              {selectedRecurso.tipo === 'TAREA' && selectedRecurso.titulo?.startsWith('[QUIZ]') && (
                <QuizPlayer
                  curso_id={curso_id as string}
                  recurso_guid={selectedRecurso.guid}
                  bloque_titulo={selectedRecurso.titulo.replace('[QUIZ] ', '')}
                  quiz_config_raw={selectedRecurso.quiz_config || ''}
                  instrucciones_html={selectedRecurso.contenido_html || ''}
                  url_referencia={selectedRecurso.url_referencia}
                  archivo_adjunto={selectedRecurso.archivo_adjunto}
                  archivo_adjunto_nombre={selectedRecurso.archivo_adjunto_nombre}
                  onFinish={() => fetchProgreso()}
                  onQuizStateChange={(active) => setIsQuizActive(active)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
