"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/contexts/RoleContext";
import { Plus, BookOpen, Layers, ArrowRight, ArrowLeft, ShieldAlert, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function ConstructorCursosRoot() {
  const { role, user } = useRole();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [cursos, setCursos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCourse, setActiveCourse] = useState<any>(null);

  // Examiner assignment state
  const [profesores, setProfesores] = useState<any[]>([]);
  const [selectedProfesorGuid, setSelectedProfesorGuid] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchData();
    fetchProfesores();
  }, []);

  // Auto-open course from URL query param (when teacher navigates from their dashboard)
  useEffect(() => {
    const cursoParam = searchParams?.get('curso');
    if (cursoParam && cursos.length === 0 && !activeCourse) {
      // Fetch the specific course directly
      fetch(`http://localhost:3200/api/cursos/${cursoParam}`)
        .then(r => r.json())
        .then(data => setActiveCourse(data))
        .catch(console.error);
    }
  }, [searchParams]);

  const fetchData = async () => {
    try {
        const res = await fetch('http://localhost:3200/api/cursos?role=admin');
        const data = await res.json();
        setCursos(data);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const fetchProfesores = async () => {
    try {
        const res = await fetch('http://localhost:3200/api/cursos/profesores');
        const data = await res.json();
        setProfesores(data);
    } catch (e) {
        console.error(e);
    }
  };

  const handleCrearCurso = async () => {
      try {
          const res = await fetch('http://localhost:3200/api/cursos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ titulo: 'Nuevo Curso Interactivo', profesor_guid: user?.guid })
          });
          const newCourse = await res.json();
          window.location.reload();
      } catch (err) {
          console.error(err);
      }
  };

  const handleCrearModulo = async () => {
      if (!activeCourse) return;
      try {
          await fetch(`http://localhost:3200/api/cursos/${activeCourse.guid}/modulos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ titulo: `Módulo ${activeCourse.modulos?.length + 1 || 1} Nuevo` })
          });
          // Refresh course details
          const resDetails = await fetch(`http://localhost:3200/api/cursos/${activeCourse.guid}`);
          setActiveCourse(await resDetails.json());
      } catch (err) {
          console.error(err);
      }
  };

  if (role !== 'admin' && role !== 'teacher') {
    return (
        <div className="flex flex-col items-center justify-center h-[70vh] animate-in fade-in">
            <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
            <h1 className="text-2xl font-bold">Acceso Restringido</h1>
        </div>
    );
  }

  if (loading) {
      return <div className="min-h-screen flex items-center justify-center font-bold text-muted-foreground">Cargando constructor...</div>;
  }

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-700 h-[calc(100vh-6rem)] flex flex-col">
        <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                Constructor Maestro <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full font-bold uppercase tracking-wider">Edición Estructurada</span>
            </h1>
            <p className="text-muted-foreground mt-1">Estructura jerárquica de cursos: Curso {'->'} Módulo {'->'} Bloques</p>
        </header>

        {cursos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-card rounded-2xl border border-border/50 shadow-sm border-dashed">
                <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-6" />
                <h3 className="text-xl font-bold text-foreground mb-2">No hay cursos creados</h3>
                <p className="text-muted-foreground mb-8 text-center max-w-sm">Comienza agregando tu primer curso a la plataforma para empezar a estructurar el conocimiento.</p>
                
                <button onClick={handleCrearCurso} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-4 rounded-xl shadow-md transition-transform hover:-translate-y-1">
                    <Plus className="h-5 w-5" /> Crear Primer Curso
                </button>
            </div>
        ) : activeCourse ? (
            <div className="flex-1 flex flex-col items-center">
                <div className="w-full max-w-4xl bg-white dark:bg-card border border-border rounded-3xl p-8 shadow-sm flex flex-col relative">
                    {/* Back Button */}
                    <button onClick={() => setActiveCourse(null)} className="absolute top-6 left-6 p-2 bg-muted rounded-full hover:bg-border transition-colors">
                        <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                    </button>

                    <div className="mb-8 pb-6 border-b border-border/50 px-4">
                        <span className="text-primary font-bold tracking-widest uppercase text-xs mb-4 block text-center">Configuración del Curso</span>
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Título del Curso</label>
                                <input id="editCursoTitulo" type="text" defaultValue={activeCourse.titulo} className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 text-xl" />
                            </div>
                            <div className="w-48">
                                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Estado</label>
                                <select id="editCursoEstado" defaultValue={activeCourse.estado} className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm">
                                    <option value="BORRADOR">Borrador</option>
                                    <option value="PUBLICADO">Publicado</option>
                                </select>
                            </div>
                            <button 
                                onClick={async (e) => {
                                    const btn = e.currentTarget;
                                    btn.innerText = 'Guardando...';
                                    const newTitulo = (document.getElementById('editCursoTitulo') as HTMLInputElement).value;
                                    const newEstado = (document.getElementById('editCursoEstado') as HTMLSelectElement).value;
                                    await fetch(`http://localhost:3200/api/cursos/${activeCourse.guid}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ titulo: newTitulo, estado: newEstado })
                                    });
                                    btn.innerText = '¡Guardado!';
                                    setTimeout(() => btn.innerText = 'Guardar Curso', 2000);
                                    fetchData(); // Refresh list to reflect state changes
                                }}
                                className="bg-primary hover:bg-primary/90 text-white font-bold px-6 py-2 rounded-xl mb-[2px] transition-colors"
                            >
                                Guardar Curso
                            </button>
                        </div>
                    </div>

                    {/* Examiner Assignment Panel — solo admins */}
                    {role === 'admin' && (
                    <div className="mb-6 pb-6 border-b border-border/50 px-4">
                        <div className="flex items-center gap-2 mb-3">
                            <UserCheck className="h-4 w-4 text-primary" />
                            <label className="text-xs font-bold text-muted-foreground uppercase">Asignar Examinador al Curso</label>
                        </div>
                        <div className="flex flex-col md:flex-row gap-3 items-end">
                            <div className="flex-1">
                                <select
                                    value={selectedProfesorGuid}
                                    onChange={(e) => setSelectedProfesorGuid(e.target.value)}
                                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                >
                                    <option value="">— Seleccionar examinador —</option>
                                    {profesores.map((p: any) => (
                                        <option key={p.guid} value={p.guid}>
                                            {p.nombre} {p.apellido} ({p.email})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                disabled={!selectedProfesorGuid || assigning}
                                onClick={async () => {
                                    if (!selectedProfesorGuid) return;
                                    setAssigning(true);
                                    await fetch(`http://localhost:3200/api/cursos/${activeCourse.guid}/asignar`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ profesor_guid: selectedProfesorGuid })
                                    });
                                    setAssigning(false);
                                    setSelectedProfesorGuid('');
                                    alert('Examinador asignado correctamente.');
                                }}
                                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold px-6 py-2 rounded-xl transition-colors disabled:opacity-40 whitespace-nowrap"
                            >
                                {assigning ? 'Asignando…' : 'Asignar'}
                            </button>
                        </div>
                        {activeCourse.profesor_guid && (
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                <UserCheck className="h-3 w-3 text-emerald-500" />
                                Examinador actual: <span className="font-semibold text-foreground ml-1">
                                    {profesores.find((p: any) => p.guid === activeCourse.profesor_guid)
                                        ? `${profesores.find((p: any) => p.guid === activeCourse.profesor_guid)?.nombre} ${profesores.find((p: any) => p.guid === activeCourse.profesor_guid)?.apellido}`
                                        : activeCourse.profesor_guid}
                                </span>
                            </p>
                        )}
                    </div>
                    )} {/* end role === admin assignment panel */}

                    <div className="flex-1 flex flex-col gap-4">
                        {(!activeCourse.modulos || activeCourse.modulos.length === 0) ? (
                            <div className="flex-1 flex items-center justify-center py-12">
                                <button onClick={handleCrearModulo} className="flex items-center gap-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold px-6 py-4 rounded-xl shadow-sm transition-transform hover:scale-105">
                                    <Layers className="h-5 w-5" /> Agregar Primer Módulo
                                </button>
                            </div>
                        ) : (
                            <>
                                {activeCourse.modulos.map((mod: any, i: number) => (
                                    <Link key={mod.guid} href={`/dashboard/constructor-cursos/${activeCourse.guid}/modulos/${mod.guid}`}
                                        className="bg-muted/30 border border-border rounded-2xl p-6 flex items-center justify-between hover:border-primary/50 hover:bg-muted/50 transition-all group shadow-sm cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-bold text-lg">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{mod.titulo}</h3>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {(mod.lecciones?.[0]?.recursos?.length || 0)} bloques de contenido
                                                </p>
                                            </div>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-colors shadow-sm">
                                            <ArrowRight className="h-5 w-5" />
                                        </div>
                                    </Link>
                                ))}

                                <div className="mt-8 flex justify-center pt-8 border-t border-border/30">
                                    <button onClick={handleCrearModulo} className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted px-4 py-2 rounded-lg font-bold text-sm transition-colors border border-dashed border-border hover:border-solid hover:border-muted-foreground">
                                        <Plus className="h-4 w-4" /> Agregar un nuevo módulo
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Botón rápido Crear Curso — solo admins */}
                {role === 'admin' && (
                    <button onClick={handleCrearCurso} className="min-h-[200px] border-2 border-dashed border-primary/50 bg-primary/5 rounded-2xl flex flex-col items-center justify-center hover:bg-primary/10 transition-colors group">
                        <Plus className="h-8 w-8 text-primary mb-2 group-hover:scale-125 transition-transform" />
                        <span className="font-bold text-primary">Crear Nuevo Curso</span>
                    </button>
                )}

                {cursos.map(curso => (
                    <div 
                        key={curso.guid} 
                        onClick={async () => {
                            setLoading(true);
                            const resDetails = await fetch(`http://localhost:3200/api/cursos/${curso.guid}`);
                            setActiveCourse(await resDetails.json());
                            setLoading(false);
                        }}
                        className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-primary/50 group block cursor-pointer"
                    >
                        <div className="h-32 bg-primary/10 relative flex items-center justify-center overflow-hidden">
                            {curso.imagen_portada ? (
                               // eslint-disable-next-line @next/next/no-img-element
                               <img src={curso.imagen_portada} alt={curso.titulo} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            ) : (
                               <BookOpen className="h-12 w-12 text-primary/30 group-hover:scale-110 transition-transform" />
                            )}
                            <div className="absolute inset-0 border-b border-border/30" />
                        </div>
                        <div className="p-5">
                            <h2 className="font-bold text-lg leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">{curso.titulo}</h2>
                            <div className="flex justify-between items-center mt-6">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{curso.estado}</span>
                                <span className="text-sm font-semibold text-primary group-hover:translate-x-1 transition-transform flex items-center gap-1">Editar <ArrowRight className="h-3 w-3" /></span>
                            </div>
                        </div>
                    </div>
                ))}
             </div>
        )}
    </div>
  );
}
