"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRole } from "@/contexts/RoleContext";
import { Plus, BookOpen, Layers, ArrowRight, ArrowLeft, ShieldAlert, UserCheck, Image as ImageIcon, Type, FileText, CheckCircle, UploadCloud, Save, X, Eye, Trash2, Edit3, Link as LinkIcon, ChevronDown, ChevronRight, PlayCircle, AlertTriangle, Paperclip, ExternalLink, Clock, RefreshCcw } from "lucide-react";
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

  // States for new UI Layout
  const [savingCourse, setSavingCourse] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [selectedItem, setSelectedItem] = useState<{type: 'MODULE' | 'RESOURCE' | null, data: any, moduloId?: string}>({type: null, data: null});
  const [menuOpenForModule, setMenuOpenForModule] = useState<string | null>(null);
  
  // States for block editing inside the main panel
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [bloqueTipo, setBloqueTipo] = useState<'PARRAFO'|'IMAGEN'|'TAREA'|'CUESTIONARIO'|'ENLACE'|null>(null);
  const [bloqueTitulo, setBloqueTitulo] = useState('');
  const [bloqueHtml, setBloqueHtml] = useState('');
  const [bloqueBase64, setBloqueBase64] = useState<string>('');
  const [savingBlock, setSavingBlock] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{open: boolean; title: string; message: string; onConfirm: () => void}>({open: false, title: '', message: '', onConfirm: () => {}});

  const showConfirm = useCallback((title: string, message: string): Promise<boolean> => {
      return new Promise((resolve) => {
          setConfirmModal({
              open: true,
              title,
              message,
              onConfirm: () => {
                  setConfirmModal(prev => ({...prev, open: false}));
                  resolve(true);
              }
          });
          // Store reject for cancel
          (window as any).__confirmReject = () => {
              setConfirmModal(prev => ({...prev, open: false}));
              resolve(false);
          };
      });
  }, []);

  useEffect(() => {
    fetchData();
    fetchProfesores();
    import('@justinribeiro/lite-youtube').catch(console.error);
  }, []);

  // Auto-open course from URL query param (when teacher navigates from their dashboard)
  useEffect(() => {
    const cursoParam = searchParams?.get('curso');
    if (cursoParam && cursos.length === 0 && !activeCourse) {
      // Fetch the specific course directly
      fetch(`http://localhost:3200/api/cursos/${cursoParam}`)
        .then(r => r.json())
        .then(data => {
            setActiveCourse(data);
        })
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
              body: JSON.stringify({ titulo: 'Curso Nuevo', profesor_guid: user?.guid })
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
          await refreshActiveCourse();
      } catch (err) {
          console.error(err);
      }
  };

  const refreshActiveCourse = async () => {
      if (!activeCourse) return;
      try {
          const resDetails = await fetch(`http://localhost:3200/api/cursos/${activeCourse.guid}`);
          setActiveCourse(await resDetails.json());
      } catch(err) {
          console.error(err);
      }
  };

  const handleUpdateCourseTitle = async (newTitle: string) => {
      if (!activeCourse) return;
      try {
          await fetch(`http://localhost:3200/api/cursos/${activeCourse.guid}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ titulo: newTitle })
          });
          setActiveCourse({...activeCourse, titulo: newTitle});
          fetchData(); // Refresh list to reflect state changes
      } catch (err) {
          console.error(err);
      }
  };

  const handleUpdateModuleTitle = async (moduleId: string, newTitle: string) => {
      try {
          await fetch(`http://localhost:3200/api/cursos/modulos/${moduleId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ titulo: newTitle })
          });
          await refreshActiveCourse();
      } catch (err) {
          console.error(err);
      }
  };

  // --- Handlers from old modal system ---
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setBloqueBase64(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setBloqueBase64(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const openAppEdit = (recurso: any, moduloId: string) => {
      setEditingBlockId(recurso.guid);
      
      let modalType: 'PARRAFO'|'IMAGEN'|'TAREA'|'CUESTIONARIO'|'ENLACE' = 'PARRAFO';
      if (recurso.tipo === 'TEXTO') modalType = 'PARRAFO';
      if (recurso.tipo === 'ENLACE') modalType = 'ENLACE';
      if (recurso.tipo === 'TAREA' && !recurso.titulo.startsWith('[QUIZ]')) modalType = 'TAREA';
      if (recurso.tipo === 'TAREA' && recurso.titulo.startsWith('[QUIZ]')) modalType = 'CUESTIONARIO';

      let cleanTitle = recurso.titulo;
      if (modalType === 'CUESTIONARIO') cleanTitle = cleanTitle.replace('[QUIZ] ', '');

      setBloqueTitulo(cleanTitle);
      
      setBloqueHtml(recurso.contenido_html || '');
      if (modalType === 'IMAGEN') setBloqueBase64(recurso.url_archivo || recurso.contenido_html || '');

      setBloqueTipo(modalType);
      setSelectedItem({ type: 'RESOURCE', data: recurso, moduloId });
  };

  // Helper to render optional extras in preview
  const renderExtrasPreview = (recurso: any) => {
      const extras = [];
      if (recurso?.url_referencia) {
          extras.push(
              <div key="url" className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                  <ExternalLink className="h-4 w-4 text-primary flex-shrink-0" />
                  <a href={recurso.url_referencia} target="_blank" rel="noopener noreferrer" className="text-sm text-primary font-medium truncate hover:underline">{recurso.url_referencia}</a>
              </div>
          );
      }
      if (recurso?.archivo_adjunto_nombre && recurso?.archivo_adjunto) {
          extras.push(
              <a key="file" href={`http://localhost:3200/api/cursos/download/${recurso.archivo_adjunto}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-muted/30 border border-border rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
                  <Paperclip className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium truncate text-primary hover:underline">{recurso.archivo_adjunto_nombre}</span>
              </a>
          );
      }
      if (recurso?.quiz_config) {
          try {
              const qc = JSON.parse(recurso.quiz_config);
              extras.push(
                  <div key="quiz" className="flex items-center gap-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-sm">
                      <span className="flex items-center gap-1 font-medium"><RefreshCcw className="h-3.5 w-3.5 text-amber-500" /> {qc.intentos_permitidos} intento(s)</span>
                      <span className="flex items-center gap-1 font-medium"><Clock className="h-3.5 w-3.5 text-amber-500" /> {qc.tiempo_minutos > 0 ? `${qc.tiempo_minutos} min` : 'Sin límite'}</span>
                      <span className="flex items-center gap-1 font-medium"><CheckCircle className="h-3.5 w-3.5 text-amber-500" /> {qc.preguntas?.length || 0} pregunta(s)</span>
                  </div>
              );
          } catch {}
      }
      return extras.length > 0 ? <div className="space-y-2 mt-4">{extras}</div> : null;
  };

  const handleDeleteBlock = async (id: string) => {
      const ok = await showConfirm('Eliminar recurso', '¿Estás seguro de que deseas eliminar este recurso? Esta acción no se puede deshacer.');
      if (!ok) return;
      try {
          const res = await fetch(`http://localhost:3200/api/cursos/bloques/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Error al eliminar');
          
          setActiveCourse((prev: any) => {
             const newCourse = {...prev};
             newCourse.modulos = newCourse.modulos.map((m: any) => {
                 const newM = {...m};
                 if (newM.lecciones && newM.lecciones.length > 0) {
                     newM.lecciones = [...newM.lecciones];
                     newM.lecciones[0] = {...newM.lecciones[0]};
                     newM.lecciones[0].recursos = newM.lecciones[0].recursos.filter((r: any) => r.guid !== id);
                 }
                 return newM;
             });
             return newCourse;
          });
          
          setSelectedItem({type: null, data: null});
      } catch (err) {
          console.error(err);
      }
  };

  const toggleModule = (moduleId: string) => {
      setExpandedModules(prev => ({...prev, [moduleId]: !prev[moduleId]}));
  };

  const startNewBlock = async (moduleId: string, tipo: 'PARRAFO'|'IMAGEN'|'TAREA'|'CUESTIONARIO'|'ENLACE') => {
      let finalTipo = tipo === 'IMAGEN' ? 'ENLACE' : tipo === 'PARRAFO' ? 'TEXTO' : tipo;
      let finalTitulo = (tipo === 'PARRAFO' ? 'Bloque de Texto' : tipo === 'IMAGEN' ? 'Imagen' : tipo === 'ENLACE' ? 'Video' : tipo);
      
      if (tipo === 'CUESTIONARIO') {
          finalTipo = 'TAREA'; 
          finalTitulo = `[QUIZ] Cuestionario`;
      }
      
      try {
          const res = await fetch(`http://localhost:3200/api/cursos/modulos/${moduleId}/bloques`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tipo: finalTipo, titulo: finalTitulo, contenido_html: '' })
          });
          const newBlock = await res.json();
          router.push(`/dashboard/constructor-cursos/${activeCourse.guid}/modulos/${moduleId}/bloques/${newBlock.guid}`);
      } catch (e) {
          console.error(e);
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
        {!activeCourse && (
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                    Constructor Maestro <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full font-bold uppercase tracking-wider">Edición Estructurada</span>
                </h1>
                <p className="text-muted-foreground mt-1">Estructura jerárquica de cursos: Curso {'->'} Módulo {'->'} Bloques</p>
            </header>
        )}

        {cursos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-card rounded-2xl border border-border/50 shadow-sm border-dashed">
                <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-6" />
                <h3 className="text-xl font-bold text-foreground mb-2">No hay cursos creados</h3>
                <p className="text-muted-foreground mb-8 text-center max-w-sm">Comienza agregando tu primer curso a la plataforma para empezar a estructurar el conocimiento.</p>
                
                <button type="button" onClick={handleCrearCurso} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-4 rounded-xl shadow-md transition-transform hover:-translate-y-1">
                    <Plus className="h-5 w-5" /> Crear Primer Curso
                </button>
            </div>
        ) : activeCourse ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
                {/* Header for Active Course */}
                <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-4 flex-1">
                        <button type="button" onClick={() => { setActiveCourse(null); window.history.replaceState({}, '', window.location.pathname); }} className="p-2 bg-muted rounded-full hover:bg-border transition-colors">
                            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                        </button>
                        <div className="flex flex-col flex-1 max-w-xl group">
                            <input 
                                type="text" 
                                defaultValue={activeCourse.titulo} 
                                onBlur={(e) => handleUpdateCourseTitle(e.target.value)}
                                className="font-bold text-2xl leading-none bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-1 w-full transition-colors text-foreground"
                                placeholder="Nombre del curso"
                            />
                            <span className="text-xs text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Haz clic para editar el nombre del curso</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <select 
                            value={activeCourse.estado} 
                            onChange={async (e) => {
                                const newEstado = e.target.value;
                                await fetch(`http://localhost:3200/api/cursos/${activeCourse.guid}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ estado: newEstado })
                                });
                                setActiveCourse({...activeCourse, estado: newEstado});
                                fetchData();
                            }}
                            className="bg-muted border border-border rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            <option value="BORRADOR">Borrador</option>
                            <option value="PUBLICADO">Publicado</option>
                        </select>
                        
                        <button 
                            type="button"
                            onClick={async (e) => {
                                e.preventDefault();
                                const ok = await showConfirm('Eliminar curso', '¿Estás seguro de eliminar este curso por completo? Se borrarán todos los módulos y recursos asociados.');
                                if (ok) {
                                    try {
                                        const res = await fetch(`http://localhost:3200/api/cursos/${activeCourse.guid}`, { method: 'DELETE' });
                                        if (!res.ok) throw new Error('Error al eliminar');
                                        
                                        const deletedGuid = activeCourse.guid;
                                        setActiveCourse(null);
                                        setCursos(prev => prev.filter(c => c.guid !== deletedGuid));
                                        window.history.replaceState({}, '', window.location.pathname);
                                    } catch (err) {
                                        console.error(err);
                                    }
                                }
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-transform hover:-translate-y-0.5 flex items-center gap-2"
                        >
                            <Trash2 className="h-5 w-5" />
                            Eliminar curso
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 h-[calc(100%-80px)] overflow-hidden">
                    {/* Main Content Panel (Left/Center) */}
                    <div className="flex-1 bg-muted/10 overflow-y-auto p-8 relative">
                        {!selectedItem.type ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                                <BookOpen className="h-24 w-24 mb-6" />
                                <h2 className="text-xl font-bold mb-2">Selecciona un elemento del temario</h2>
                                <p className="text-center max-w-sm">Haz clic en un módulo o recurso en el panel lateral derecho para ver y editar su contenido aquí.</p>
                            </div>
                        ) : selectedItem.type === 'MODULE' ? (
                            <div className="max-w-3xl mx-auto bg-card rounded-2xl shadow-sm border border-border p-8">
                                <h2 className="text-2xl font-bold flex items-center gap-3 mb-6">
                                    <Layers className="h-6 w-6 text-primary" /> Configuración del Módulo
                                </h2>
                                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Nombre del Módulo</label>
                                <input 
                                    type="text" 
                                    defaultValue={selectedItem.data.titulo}
                                    onBlur={(e) => handleUpdateModuleTitle(selectedItem.data.guid, e.target.value)}
                                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg"
                                />
                                <p className="text-sm text-muted-foreground mt-4">
                                    Este módulo contiene {(selectedItem.data.lecciones?.[0]?.recursos?.length || 0)} recursos o tareas. Utiliza el panel lateral para añadir más contenido.
                                </p>
                            </div>
                        ) : selectedItem.type === 'RESOURCE' && bloqueTipo ? (
                            <div className="max-w-4xl mx-auto bg-card rounded-2xl shadow-sm border border-border flex flex-col overflow-hidden h-full max-h-full">
                                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                                    <h3 className="font-bold flex items-center gap-2">
                                        {bloqueTipo === 'PARRAFO' && <Type className="h-5 w-5 text-primary" />}
                                        {bloqueTipo === 'ENLACE' && <PlayCircle className="h-5 w-5 text-pink-500" />}
                                        {bloqueTipo === 'TAREA' && <FileText className="h-5 w-5 text-blue-500" />}
                                        {bloqueTipo === 'CUESTIONARIO' && <CheckCircle className="h-5 w-5 text-amber-500" />}
                                        {bloqueTitulo || 'Sin título'}
                                    </h3>
                                    {editingBlockId && (
                                        <div className="flex items-center gap-2">
                                            <button 
                                                type="button"
                                                onClick={async (e) => {
                                                    e.preventDefault();
                                                    router.push(`/dashboard/constructor-cursos/${activeCourse.guid}/modulos/${selectedItem.moduloId}/bloques/${editingBlockId}`);
                                                }}
                                                className="bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                                            >
                                                <Edit3 className="h-4 w-4" /> Editar Contenido
                                            </button>
                                            <button type="button" onClick={() => handleDeleteBlock(editingBlockId)} className="text-red-500 hover:text-red-600 bg-red-500/10 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors">
                                                <Trash2 className="h-4 w-4" /> Eliminar
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="p-8 overflow-y-auto flex-1 space-y-8 bg-background">
                                    {bloqueTipo === 'PARRAFO' && (
                                        <>
                                            <div className="prose dark:prose-invert max-w-none bg-muted/10 p-8 rounded-2xl border border-border/50 shadow-inner" dangerouslySetInnerHTML={{ __html: bloqueHtml || '<p class="text-muted-foreground italic">Sin contenido escrito.</p>' }} />
                                            {selectedItem.data && renderExtrasPreview(selectedItem.data)}
                                        </>
                                    )}

                                    {bloqueTipo === 'ENLACE' && (
                                        <div className="flex flex-col items-center">
                                            {bloqueHtml && bloqueHtml.includes('youtube.com/watch?v=') && (
                                                <div className="w-full max-w-3xl rounded-2xl overflow-hidden border border-border shadow-sm">
                                                    {/* @ts-ignore */}
                                                    <lite-youtube videoid={new URL(bloqueHtml).searchParams.get('v')}></lite-youtube>
                                                </div>
                                            )}
                                            {bloqueHtml && bloqueHtml.includes('youtu.be/') && (
                                                <div className="w-full max-w-3xl rounded-2xl overflow-hidden border border-border shadow-sm">
                                                    {/* @ts-ignore */}
                                                    <lite-youtube videoid={bloqueHtml.split('youtu.be/')[1].split('?')[0]}></lite-youtube>
                                                </div>
                                            )}
                                            {!bloqueHtml && (
                                                <div className="w-full max-w-3xl h-64 bg-muted/20 border border-border border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground">
                                                    <PlayCircle className="h-12 w-12 opacity-30 mb-4" />
                                                    <p>Video de YouTube no configurado. Haz clic en "Editar Contenido".</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {bloqueTipo === 'TAREA' && (
                                        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden max-w-3xl mx-auto">
                                            <div className="p-6 border-b border-border bg-muted/10">
                                                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4">Instrucciones de la Tarea</h3>
                                                <div className="prose dark:prose-invert max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: bloqueHtml || '<p class="text-muted-foreground italic opacity-70">No hay instrucciones definidas.</p>' }} />
                                                {selectedItem.data && renderExtrasPreview(selectedItem.data)}
                                            </div>
                                            <div className="p-8 flex flex-col items-center justify-center text-center">
                                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                                                    <UploadCloud className="h-10 w-10 text-primary" />
                                                </div>
                                                <h3 className="font-bold text-xl mb-2">Área de Entrega</h3>
                                                <p className="text-muted-foreground text-sm max-w-md mb-8">Esta es una simulación visual. Al realizar el curso, el estudiante verá este espacio para subir su respuesta.</p>
                                                <button disabled className="bg-primary/50 text-white px-8 py-3 rounded-xl font-bold cursor-not-allowed">
                                                    Subir Archivo
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {bloqueTipo === 'CUESTIONARIO' && (
                                        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden max-w-3xl mx-auto">
                                            <div className="p-6 border-b border-border bg-amber-500/10">
                                                <h3 className="font-bold text-sm text-amber-700 dark:text-amber-500 uppercase tracking-wider mb-4">Instrucciones del Cuestionario</h3>
                                                <div className="prose dark:prose-invert max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: bloqueHtml || '<p class="text-muted-foreground italic opacity-70">No hay instrucciones definidas.</p>' }} />
                                                {selectedItem.data && renderExtrasPreview(selectedItem.data)}
                                            </div>
                                            <div className="p-8 flex flex-col items-center justify-center text-center">
                                                <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mb-4">
                                                    <CheckCircle className="h-10 w-10 text-amber-500" />
                                                </div>
                                                <h3 className="font-bold text-xl mb-2">Cuestionario Interactivo</h3>
                                                <p className="text-muted-foreground text-sm max-w-md mb-8">Esta es una simulación visual. Al realizar el curso, el estudiante accederá al cuestionario interactivo desde aquí.</p>
                                                <button disabled className="bg-amber-500/50 text-white px-8 py-3 rounded-xl font-bold cursor-not-allowed">
                                                    Comenzar Intento
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Right Sidebar (Temario del curso) */}
                    <div className="w-[350px] bg-card border-l border-border overflow-y-auto flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
                        <div className="p-5 border-b border-border sticky top-0 bg-inherit z-10">
                            <h2 className="font-bold text-lg tracking-tight flex items-center gap-2 uppercase text-muted-foreground">
                                <Layers className="h-5 w-5" /> Temario del Curso
                            </h2>
                        </div>
                        
                        <div className="p-4 flex-1 space-y-4">
                            {(!activeCourse.modulos || activeCourse.modulos.length === 0) ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    No hay módulos creados aún.
                                </div>
                            ) : (
                                activeCourse.modulos.map((mod: any, i: number) => {
                                    const isExpanded = expandedModules[mod.guid];
                                    const recursos = mod.lecciones?.[0]?.recursos || [];
                                    
                                    return (
                                        <div key={mod.guid} className="border border-border/50 rounded-xl bg-muted/5">
                                            {/* Module Header */}
                                            <div 
                                                className={`flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors ${selectedItem.type === 'MODULE' && selectedItem.data.guid === mod.guid ? 'bg-primary/10 border-l-4 border-l-primary' : ''}`}
                                            >
                                                <div className="flex items-center gap-2 flex-1" onClick={() => {
                                                    toggleModule(mod.guid);
                                                    setSelectedItem({ type: 'MODULE', data: mod });
                                                }}>
                                                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                                    <span className="font-bold text-sm truncate flex-1">{mod.titulo}</span>
                                                </div>
                                                <div className="relative flex items-center gap-1">
                                                    <button 
                                                        type="button"
                                                        onClick={async (e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            const ok = await showConfirm('Eliminar módulo', `¿Eliminar el módulo "${mod.titulo}"? Todo su contenido será borrado permanentemente.`);
                                                            if (ok) {
                                                                try {
                                                                    const res = await fetch(`http://localhost:3200/api/cursos/modulos/${mod.guid}`, { method: 'DELETE' });
                                                                    if (!res.ok) throw new Error('Error');
                                                                    
                                                                    setActiveCourse((prev: any) => ({
                                                                        ...prev,
                                                                        modulos: prev.modulos.filter((m: any) => m.guid !== mod.guid)
                                                                    }));
                                                                    
                                                                    if (selectedItem.type === 'MODULE' && selectedItem.data.guid === mod.guid) {
                                                                        setSelectedItem({type: null, data: null});
                                                                    }
                                                                } catch (err) {
                                                                    console.error(err);
                                                                }
                                                            }
                                                        }} 
                                                        className="p-1.5 bg-red-500/10 rounded border border-red-500/20 shadow-sm text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                                                        title="Eliminar módulo"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpenForModule(menuOpenForModule === mod.guid ? null : mod.guid); }} 
                                                        className="p-1.5 bg-background rounded border border-border shadow-sm text-muted-foreground hover:text-primary transition-colors hover:border-primary/30"
                                                        title="Añadir tarea a este módulo"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </button>
                                                    
                                                    {/* Dropdown Add Task */}
                                                    {menuOpenForModule === mod.guid && (
                                                        <div className="absolute right-0 top-10 w-48 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2">
                                                            <div className="p-2 text-xs font-bold text-muted-foreground border-b border-border/50 bg-muted/30">Añadir Recurso</div>
                                                            <div className="p-1">
                                                                <button onClick={() => startNewBlock(mod.guid, 'ENLACE')} className="w-full flex items-center gap-2 p-2 hover:bg-muted rounded-lg text-sm transition-colors text-left font-medium">
                                                                    <PlayCircle className="h-4 w-4 text-pink-500" /> Video / Enlace
                                                                </button>
                                                                <button onClick={() => startNewBlock(mod.guid, 'PARRAFO')} className="w-full flex items-center gap-2 p-2 hover:bg-muted rounded-lg text-sm transition-colors text-left font-medium">
                                                                    <Type className="h-4 w-4 text-primary" /> Texto
                                                                </button>
                                                                <button onClick={() => startNewBlock(mod.guid, 'CUESTIONARIO')} className="w-full flex items-center gap-2 p-2 hover:bg-muted rounded-lg text-sm transition-colors text-left font-medium">
                                                                    <CheckCircle className="h-4 w-4 text-amber-500" /> Quiz
                                                                </button>
                                                                <button onClick={() => startNewBlock(mod.guid, 'TAREA')} className="w-full flex items-center gap-2 p-2 hover:bg-muted rounded-lg text-sm transition-colors text-left font-medium">
                                                                    <FileText className="h-4 w-4 text-blue-500" /> Tarea
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Module Content (Resources) */}
                                            {isExpanded && (
                                                <div className="bg-background border-t border-border/30 px-3 py-2 space-y-1">
                                                    {recursos.length === 0 ? (
                                                        <div className="text-xs text-muted-foreground py-2 italic text-center">Vacío</div>
                                                    ) : (
                                                        recursos.map((r: any) => {
                                                            const isQuiz = r.tipo === 'TAREA' && r.titulo.startsWith('[QUIZ]');
                                                            const displayTitle = isQuiz ? r.titulo.replace('[QUIZ] ', '') : r.titulo;
                                                            const isSelected = selectedItem.type === 'RESOURCE' && selectedItem.data.guid === r.guid;

                                                            return (
                                                                <div 
                                                                    key={r.guid}
                                                                    onClick={() => openAppEdit(r, mod.guid)}
                                                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors text-sm ${isSelected ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                                                                >
                                                                    {r.tipo === 'TEXTO' && <Type className="h-4 w-4 shrink-0" />}
                                                                    {r.tipo === 'ENLACE' && (r.contenido_html?.startsWith('data:image') || r.url_archivo?.startsWith('data:image')) && <ImageIcon className="h-4 w-4 shrink-0" />}
                                                                    {r.tipo === 'ENLACE' && !(r.contenido_html?.startsWith('data:image') || r.url_archivo?.startsWith('data:image')) && <PlayCircle className="h-4 w-4 shrink-0" />}
                                                                    {r.tipo === 'TAREA' && !isQuiz && <FileText className="h-4 w-4 shrink-0" />}
                                                                    {r.tipo === 'TAREA' && isQuiz && <CheckCircle className="h-4 w-4 shrink-0" />}
                                                                    
                                                                    <span className="truncate flex-1">{displayTitle}</span>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}

                            <button 
                                onClick={handleCrearModulo}
                                className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-border rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-bold text-sm"
                            >
                                <Plus className="h-4 w-4" /> Agregar Módulo
                            </button>
                        </div>
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
                            try {
                                const resDetails = await fetch(`http://localhost:3200/api/cursos/${curso.guid}`);
                                const data = await resDetails.json();
                                setActiveCourse(data);
                                // Update URL without reloading so F5 works
                                window.history.pushState({}, '', `?curso=${curso.guid}`);
                            } catch(e) { console.error(e) }
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
    {/* Custom Confirmation Modal */}
    {confirmModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-500/15 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">{confirmModal.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{confirmModal.message}</p>
                </div>
                <div className="px-6 pb-6 flex items-center gap-3">
                    <button 
                        type="button"
                        onClick={() => (window as any).__confirmReject?.()}
                        className="flex-1 bg-muted hover:bg-border text-foreground font-bold py-3 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="button"
                        onClick={() => confirmModal.onConfirm()}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors shadow-md"
                    >
                        Sí, eliminar
                    </button>
                </div>
            </div>
        </div>
    )}
    </div>
  );
}
