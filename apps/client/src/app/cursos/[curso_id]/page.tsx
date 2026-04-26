"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, FileText, Type, CheckCircle, Trophy, Lock, PlayCircle, Paperclip, UploadCloud, Loader2, ExternalLink } from "lucide-react";
import { PageLoader } from "@/components/PageLoader";
import Link from "next/link";

export default function CursoVisorPage() {
  const { curso_id } = useParams();
  const router = useRouter();
  const [curso, setCurso] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completados, setCompletados] = useState<string[]>([]);
  const [selectedRecurso, setSelectedRecurso] = useState<any>(null);
  const [selectedModuloGuid, setSelectedModuloGuid] = useState<string>('');
  const [userGuid, setUserGuid] = useState<string>('');

  useEffect(() => {
    const savedUser = localStorage.getItem("lms_user");
    if (savedUser) {
      try { setUserGuid(JSON.parse(savedUser).guid); } catch {}
    }
  }, []);

  useEffect(() => {
    if (curso_id) fetchCurso();
  }, [curso_id]);

  useEffect(() => {
    if (curso_id && userGuid) fetchProgreso();
  }, [curso_id, userGuid]);

  useEffect(() => {
    import('@justinribeiro/lite-youtube').catch(console.error);
  }, []);

  const fetchCurso = async () => {
    try {
      const res = await fetch(`http://localhost:3200/api/cursos/${curso_id}`);
      const data = await res.json();
      setCurso(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgreso = async () => {
    try {
      const res = await fetch(`http://localhost:3200/api/cursos/student/progreso?usuario_guid=${userGuid}&curso_guid=${curso_id}`);
      const data = await res.json();
      setCompletados(data.completados || []);
    } catch (err) {
      console.error(err);
    }
  };

  const marcarCompletado = useCallback(async (recurso_guid: string) => {
    if (!userGuid || completados.includes(recurso_guid)) return;
    try {
      await fetch('http://localhost:3200/api/cursos/student/marcar-recurso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_guid: userGuid, recurso_guid })
      });
      setCompletados(prev => [...prev, recurso_guid]);
    } catch (err) {
      console.error(err);
    }
  }, [userGuid, completados]);

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

  const modulos = curso.modulos || [];

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

  const getRecursoIcon = (recurso: any, completed: boolean, locked: boolean) => {
    if (locked) return <Lock className="h-4 w-4 text-muted-foreground/50" />;
    if (recurso.tipo === 'TEXTO') return <Type className={`h-4 w-4 ${completed ? 'text-emerald-500' : ''}`} />;
    if (recurso.tipo === 'ENLACE') return <PlayCircle className={`h-4 w-4 ${completed ? 'text-emerald-500' : 'text-pink-500'}`} />;
    if (recurso.tipo === 'TAREA' && recurso.titulo?.startsWith('[QUIZ]')) return <CheckCircle className={`h-4 w-4 ${completed ? 'text-emerald-500' : 'text-amber-500'}`} />;
    if (recurso.tipo === 'TAREA') return <FileText className={`h-4 w-4 ${completed ? 'text-emerald-500' : 'text-blue-500'}`} />;
    return <BookOpen className="h-4 w-4" />;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50 h-16 flex items-center px-6 shrink-0">
        <Link href="/dashboard/student/cursos" className="p-2 hover:bg-muted rounded-full transition-colors mr-4">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 truncate font-bold text-lg">{curso.titulo}</div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar — Module & Resource List */}
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
                    <a href={selectedRecurso.url_referencia} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary font-medium hover:bg-primary/10 transition-colors">
                      <ExternalLink className="h-4 w-4" /> {selectedRecurso.url_referencia}
                    </a>
                  )}
                  {selectedRecurso.archivo_adjunto && (
                    <a href={`http://localhost:3200/api/cursos/download/${selectedRecurso.archivo_adjunto}`} className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-xl hover:bg-primary/10 transition-colors">
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
                <div className="space-y-6">
                  <div className="prose prose-slate dark:prose-invert max-w-none bg-card rounded-2xl p-8 border border-border/50 shadow-sm" dangerouslySetInnerHTML={{ __html: selectedRecurso.contenido_html || '<p class="text-muted-foreground italic">Sin instrucciones.</p>' }} />
                  {selectedRecurso.archivo_adjunto && (
                    <a href={`http://localhost:3200/api/cursos/download/${selectedRecurso.archivo_adjunto}`} className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-xl hover:bg-primary/10 transition-colors">
                      <Paperclip className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold">{selectedRecurso.archivo_adjunto_nombre || 'Archivo adjunto'}</span>
                    </a>
                  )}
                  <div className="bg-card border border-border rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <UploadCloud className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">Área de Entrega</h3>
                    <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">Sube tu documento para que el examinador lo revise y califique.</p>
                    <button
                      onClick={() => router.push(`/cursos/${curso_id}/tareas/${selectedRecurso.guid}`)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-bold shadow-md transition-colors"
                    >
                      Ir a Subir Archivo
                    </button>
                  </div>
                </div>
              )}

              {/* QUIZ */}
              {selectedRecurso.tipo === 'TAREA' && selectedRecurso.titulo?.startsWith('[QUIZ]') && (
                <div className="space-y-6">
                  <div className="prose prose-slate dark:prose-invert max-w-none bg-card rounded-2xl p-8 border border-border/50 shadow-sm" dangerouslySetInnerHTML={{ __html: selectedRecurso.contenido_html || '<p class="text-muted-foreground italic">Sin instrucciones.</p>' }} />
                  <div className="bg-card border border-amber-500/30 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-amber-500" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">Cuestionario Interactivo</h3>
                    <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">Responde las preguntas del cuestionario para avanzar.</p>
                    <button
                      onClick={() => router.push(`/cursos/${curso_id}/tareas/${selectedRecurso.guid}`)}
                      className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-colors"
                    >
                      Comenzar Cuestionario
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
