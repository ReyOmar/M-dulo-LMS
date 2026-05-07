import { useState } from 'react';
import { Save, X, Eye, EyeOff, FileCode2, AtSign } from 'lucide-react';
import { sanitizeHTML } from '@/lib/sanitize';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

interface Plantilla {
  id: number;
  nombre_interno: string;
  asunto: string;
  cuerpo_html: string;
  activo: boolean;
  es_sistema: boolean;
}

interface Evento {
  identificador: string;
  nombre_legible: string;
  descripcion: string;
  variables: string;
  plantillas: Plantilla[];
}

interface MailTemplateEditorProps {
  evento: Evento;
  plantilla: Plantilla;
  onSave: (id: number, data: { asunto: string; cuerpo_html: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export default function MailTemplateEditor({ evento, plantilla, onSave, onCancel, isSaving }: MailTemplateEditorProps) {
  const [asunto, setAsunto] = useState(plantilla.asunto);
  const [cuerpoHtml, setCuerpoHtml] = useState(plantilla.cuerpo_html);
  const [showPreview, setShowPreview] = useState(false);

  const variablesArray: string[] = JSON.parse(evento.variables || '[]');

  const handleSave = () => {
    onSave(plantilla.id, { asunto, cuerpo_html: cuerpoHtml });
  };

  const insertVariable = (variable: string) => {
    // Basic append to HTML body (could be improved with cursor position if needed)
    setCuerpoHtml(prev => prev + ` {{${variable}}}`);
  };

  return (
    <div className="bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden flex flex-col h-full animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border/30 bg-muted/10">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-primary" />
            Editar Plantilla: {evento.nombre_legible}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{evento.descripcion}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-bold transition-colors"
          >
            {showPreview ? <><EyeOff className="h-4 w-4"/> Editar</> : <><Eye className="h-4 w-4"/> Previsualizar</>}
          </button>
          <button 
            onClick={onCancel}
            className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Editor Area */}
        <div className={`flex-1 p-6 overflow-y-auto ${showPreview ? 'hidden md:block opacity-50 pointer-events-none' : 'block'}`}>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-2">Asunto del Correo</label>
              <input 
                type="text" 
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                className="w-full px-4 py-3 bg-muted/20 border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium"
                placeholder="Ej. Bienvenido a la plataforma"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold">Cuerpo HTML</label>
              </div>
              <div className="bg-background rounded-xl border border-border/50 overflow-hidden">
                <ReactQuill 
                  theme="snow"
                  value={cuerpoHtml}
                  onChange={setCuerpoHtml}
                  className="h-[45vh]"
                  placeholder="Escribe el cuerpo del correo aquí..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Variables or Preview */}
        <div className="w-full md:w-80 border-l border-border/30 bg-muted/10 p-6 overflow-y-auto flex flex-col">
          {showPreview ? (
            <div className="flex-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <Eye className="h-4 w-4"/> Vista Previa
              </h3>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden text-slate-800">
                <div className="bg-primary p-4 text-white font-bold text-sm">
                  Asunto: {asunto || 'Sin Asunto'}
                </div>
                <div className="p-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={sanitizeHTML(cuerpoHtml)} />
              </div>
            </div>
          ) : (
            <div className="flex-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <AtSign className="h-4 w-4"/> Datos Automáticos
              </h3>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4">
                <p className="text-xs text-foreground mb-1 font-bold">
                  ¿Qué es esto?
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Haz clic en estos botones para añadir "etiquetas especiales" a tu correo. Al enviar el mensaje, el sistema reemplazará automáticamente la etiqueta por la información real de cada persona (por ejemplo, su nombre).
                </p>
              </div>
              <div className="space-y-2">
                {variablesArray.map(v => (
                  <button 
                    key={v}
                    onClick={() => insertVariable(v)}
                    className="w-full text-left p-3 bg-card border border-border/50 rounded-xl hover:border-primary hover:bg-primary/5 transition-all group flex flex-col gap-1 shadow-sm hover:shadow"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-sm text-foreground capitalize">{v.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] uppercase font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        Insertar
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono opacity-50 group-hover:opacity-100 transition-opacity">{`{{${v}}}`}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-border/30 bg-muted/5 flex items-center justify-end gap-3 mt-auto">
        <button 
          onClick={onCancel}
          className="px-6 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
        <button 
          onClick={handleSave}
          disabled={isSaving || !asunto || !cuerpoHtml}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSaving ? <span className="animate-pulse">Guardando...</span> : <><Save className="h-4 w-4"/> Guardar Cambios</>}
        </button>
      </div>
    </div>
  );
}
