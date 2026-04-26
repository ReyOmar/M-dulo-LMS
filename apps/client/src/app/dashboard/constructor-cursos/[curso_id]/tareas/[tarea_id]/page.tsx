"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageLoader } from "@/components/PageLoader";
import { ArrowLeft, Save, Type, Calendar } from "lucide-react";
import Link from "next/link";

export default function ConfigurarTareaPage() {
  const { curso_id, tarea_id } = useParams();
  const router = useRouter();

  const [tarea, setTarea] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [htmlContent, setHtmlContent] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");

  useEffect(() => {
    fetchTarea();
  }, [curso_id, tarea_id]);

  const fetchTarea = async () => {
    try {
      // Find the specific resource logic since we don't have a direct endpoint for single block
      const res = await fetch(`http://localhost:3200/api/cursos/${curso_id}`);
      const data = await res.json();
      
      let foundTarea = null;
      for (const mod of data.modulos || []) {
          for (const lec of mod.lecciones || []) {
              const rec = lec.recursos?.find((r: any) => r.guid === tarea_id);
              if (rec) {
                  foundTarea = rec;
                  break;
              }
          }
          if (foundTarea) break;
      }
      
      if (foundTarea) {
          setTarea(foundTarea);
          setHtmlContent(foundTarea.contenido_html || "");
          setFechaEntrega(foundTarea.url_archivo || ""); // Reusing url_archivo for saving the date string temporalily, in production schema add a proper field
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
      setSaving(true);
      try {
          await fetch(`http://localhost:3200/api/cursos/bloques/${tarea_id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contenido_html: htmlContent, url_archivo: fechaEntrega }) 
          });
          
          alert("Configuración de actividad guardada");
          router.back();
      } catch (err) {
          console.error(err);
      } finally {
          setSaving(false);
      }
  };

  if (loading) {
      return <PageLoader message="Cargando editor de actividad..." />;
  }

  if (!tarea) {
      return <div className="min-h-screen flex items-center justify-center font-bold text-muted-foreground">Actividad no encontrada</div>;
  }

  const isQuiz = tarea.titulo.startsWith('[QUIZ]');
  const displayTitle = isQuiz ? tarea.titulo.replace('[QUIZ] ', '') : tarea.titulo;

  return (
    <div className="min-h-screen bg-muted/10 pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border shadow-sm flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="p-2 bg-muted rounded-full hover:bg-border transition-colors">
                  <ArrowLeft className="h-5 w-5 text-muted-foreground" />
              </button>
              <div>
                  <h1 className="font-bold leading-none">Editor: {displayTitle}</h1>
                  <span className="text-xs text-muted-foreground">Configuración de parámetros y descripción</span>
              </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-xl flex items-center gap-2 font-bold transition-colors">
              <Save className="h-4 w-4" /> {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
      </header>

      <div className="max-w-[95%] xl:max-w-[90%] mx-auto mt-12 px-6">
          <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden flex flex-col">
              
              <div className="p-6 border-b border-border bg-muted/20">
                 <h2 className="font-bold flex items-center gap-2 mb-4"><Calendar className="h-5 w-5 text-primary" /> Parámetros de Entrega</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                         <label className="text-xs font-bold uppercase text-muted-foreground mb-2 block">Fecha de Entrega (Límite)</label>
                         <input type="datetime-local" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2 font-medium" />
                     </div>
                 </div>
              </div>

              <div className="p-6 flex-1">
                 <h2 className="font-bold flex items-center gap-2 mb-4"><Type className="h-5 w-5 text-primary" /> Descripción de la Actividad (HTML Rico)</h2>
                  
                  <div className="flex gap-2 mb-3 bg-muted p-2 rounded-xl w-fit">
                      <button onClick={() => setHtmlContent(htmlContent + '<b>Negrita</b>')} className="px-3 py-1 bg-background rounded font-bold text-sm shadow-sm border border-border">B</button>
                      <button onClick={() => setHtmlContent(htmlContent + '<i>Cursiva</i>')} className="px-3 py-1 bg-background rounded italic text-sm shadow-sm border border-border">I</button>
                      <button onClick={() => setHtmlContent(htmlContent + '<ul><li>Lista 1</li></ul>')} className="px-3 py-1 bg-background rounded text-sm shadow-sm border border-border">Lista</button>
                  </div>
                  
                  <textarea 
                      className="w-full h-80 p-4 border border-border rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono bg-background"
                      placeholder="Escribe las instrucciones detalladas de la tarea o cuestionario..."
                      value={htmlContent}
                      onChange={(e) => setHtmlContent(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-2 font-medium">Puedes usar formato HTML para estructurar la presentación visual a los estudiantes.</p>
              </div>
          </div>
      </div>
    </div>
  );
}
