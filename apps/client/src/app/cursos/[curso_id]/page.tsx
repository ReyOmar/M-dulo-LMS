"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Clock, FileText, Type, CheckCircle, Trophy, ChevronDown } from "lucide-react";
import Link from "next/link";

export default function CursoVisorPage() {
  const { curso_id } = useParams();
  const router = useRouter();
  const [curso, setCurso] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentModuloIndex, setCurrentModuloIndex] = useState(0);

  useEffect(() => {
    if (curso_id) fetchCurso();
  }, [curso_id]);

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

  if (loading) {
      return <div className="min-h-screen flex items-center justify-center font-bold text-muted-foreground">Cargando contenido del curso...</div>;
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
  const activeModulo = modulos[currentModuloIndex];
  // Since we abstracted Leccion, resources are in activeModulo.lecciones[0].recursos
  const recursos = (activeModulo?.lecciones?.[0]?.recursos) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navbar / Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50 h-16 flex items-center px-6">
          <Link href="/dashboard/student/cursos" className="p-2 hover:bg-muted rounded-full transition-colors mr-4">
              <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 truncate font-bold text-lg">{curso.titulo}</div>
          <div className="text-sm font-semibold text-muted-foreground">
              Módulo {currentModuloIndex + 1} de {modulos.length > 0 ? modulos.length : 1}
          </div>
      </header>

      {/* Main Content Area - 10% lateral margins logic (px-[10%]) and centered */}
      <main className="max-w-[95%] xl:max-w-[90%] mx-auto py-16 px-6 animate-in fade-in duration-700">
        
        {modulos.length === 0 ? (
            <div className="bg-card border border-border/50 rounded-2xl p-12 text-center text-muted-foreground">
                El profesor aún no ha agregado módulos a este curso.
            </div>
        ) : (
            <div className="flex flex-col gap-8">
                {/* Modulo Title Header (Optional, but good for context) */}
                <div className="text-center mb-8 border-b border-border/50 pb-8">
                    <span className="text-primary font-bold tracking-widest uppercase text-sm mb-2 block">MÓDULO ACADÉMICO</span>
                    <h2 className="text-3xl lg:text-4xl font-bold">{activeModulo.titulo}</h2>
                    {activeModulo.descripcion && <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">{activeModulo.descripcion}</p>}
                </div>

                {/* Blocks rendering */}
                {recursos.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground italic border-2 border-dashed border-border rounded-2xl">
                        Este módulo no tiene contenido disponible.
                    </div>
                ) : (
                    recursos.map((recurso: any) => (
                        <div key={recurso.guid} className="w-full bg-card rounded-2xl p-8 border border-border/50 shadow-sm">
                            
                            {/* Párrafo / Texto Rico */}
                            {recurso.tipo === 'TEXTO' && (
                                <div className="prose prose-slate dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: recurso.contenido_html }} />
                            )}

                            {/* Imagen (usamos TEXTO internamente o ENLACE/PDF dependiendo de cómo lo mande el constructor, asumimos que si tipo TEXTO y tiene un src es que viajo asi. Pero si lo hicimos con TEXTO HTML lo agarra el `prose`. Si lo enviamos como tipo PDF/ENLACE con url: */}
                            {recurso.tipo === 'ENLACE' && (recurso.contenido_html?.startsWith('data:image') || recurso.url_archivo?.startsWith('data:image')) && (
                                <div className="flex justify-center">
                                    <img src={recurso.contenido_html || recurso.url_archivo} alt="Media" className="rounded-xl max-h-[500px] object-cover" />
                                </div>
                            )}

                            {/* Enlace Externo (Hipervínculo) */}
                            {recurso.tipo === 'ENLACE' && !(recurso.contenido_html?.startsWith('data:image') || recurso.url_archivo?.startsWith('data:image')) && (
                                <a 
                                    href={recurso.url_archivo} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-center gap-4 p-4 group rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                                >
                                    <div className="flex-shrink-0 text-pink-500">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <h3 className="font-bold text-[15px] hover:text-primary transition-colors">{recurso.titulo}</h3>
                                        <p className="text-xs text-muted-foreground mt-1 truncate">{recurso.url_archivo}</p>
                                    </div>
                                </a>
                            )}

                            {/* Tarea Evaluativa */}
                            {recurso.tipo === 'TAREA' && !recurso.titulo?.startsWith('[QUIZ]') && (
                                <div className="flex items-center justify-between p-4 group">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="mt-1 flex-shrink-0 text-blue-500">
                                            <FileText className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1">
                                            <Link href={`/cursos/${curso_id}/tareas/${recurso.guid}`}>
                                                <h3 className="font-bold text-[15px] hover:text-primary transition-colors cursor-pointer">{recurso.titulo}</h3>
                                            </Link>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Cierre: {recurso.url_archivo ? new Date(recurso.url_archivo).toLocaleString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha definida'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 ml-4 hidden md:block">
                                        <div className="border border-border bg-muted/50 text-muted-foreground px-3 py-1 rounded text-xs flex items-center gap-1 cursor-pointer hover:bg-muted transition-colors">
                                            <CheckCircle className="h-3 w-3" /> Hecho <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Cuestionario */}
                            {recurso.tipo === 'TAREA' && recurso.titulo?.startsWith('[QUIZ]') && (
                                <div className="flex items-center justify-between p-4 group">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="mt-1 flex-shrink-0 text-amber-500">
                                            <CheckCircle className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1">
                                            <Link href={`/cursos/${curso_id}/tareas/${recurso.guid}`}>
                                                <h3 className="font-bold text-[15px] hover:text-primary transition-colors cursor-pointer">{recurso.titulo.replace('[QUIZ] ', '')}</h3>
                                            </Link>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Cierre: {recurso.url_archivo ? new Date(recurso.url_archivo).toLocaleString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha definida'} (1 intento)
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 ml-4 hidden md:block">
                                        <div className="border border-border bg-muted/50 text-muted-foreground px-3 py-1 rounded text-xs flex items-center gap-1 cursor-pointer hover:bg-muted transition-colors">
                                            <CheckCircle className="h-3 w-3" /> Hecho <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    ))
                )}

                {/* Footer Navigation */}
                <div className="mt-12 flex justify-center pb-20">
                    {currentModuloIndex < modulos.length - 1 ? (
                        <button 
                            onClick={() => {
                                window.scrollTo(0,0);
                                setCurrentModuloIndex(currentModuloIndex + 1);
                            }}
                            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-4 rounded-2xl shadow-lg hover:-translate-y-1 transition-all"
                        >
                            Avanzar al siguiente módulo <ArrowRight className="h-5 w-5" />
                        </button>
                    ) : (
                        <div className="px-8 py-4 bg-emerald-500/10 text-emerald-500 font-bold rounded-2xl flex items-center gap-2">
                             <Trophy className="h-5 w-5" /> Has llegado al final del curso
                        </div>
                    )}
                </div>
            </div>
        )}
      </main>
    </div>
  );
}
