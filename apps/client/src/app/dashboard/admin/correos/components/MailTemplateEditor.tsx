import { useState, useMemo } from 'react';
import { Save, X, Eye, EyeOff, FileCode2, AtSign, Sparkles, Plus } from 'lucide-react';
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

/**
 * Maps variable names to human-friendly labels and sample preview values.
 * This avoids showing raw {{variable}} syntax to the user.
 */
const VARIABLE_META: Record<string, { label: string; sample: string; color: string }> = {
  nombre: {
    label: 'Nombre',
    sample: 'Juan',
    color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
  },
  apellido: {
    label: 'Apellido',
    sample: 'Pérez',
    color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
  },
  email: {
    label: 'Correo',
    sample: 'juan@correo.com',
    color: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-500/30',
  },
  contrasena: {
    label: 'Contraseña',
    sample: '••••••••',
    color: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30',
  },
  curso: {
    label: 'Curso',
    sample: 'Módulo PESV Básico',
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  },
  tarea: {
    label: 'Tarea',
    sample: 'Evaluación Final',
    color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  },
  calificacion: {
    label: 'Calificación',
    sample: '4.5',
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  },
  mensaje_aprobacion: {
    label: 'Resultado',
    sample: '¡Aprobado! Excelente trabajo.',
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  },
  emoji: {
    label: 'Emoji',
    sample: '🎓',
    color: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-500/30',
  },
  enlace: {
    label: 'Enlace',
    sample: 'https://plataforma.com/...',
    color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
  },
  fecha: {
    label: 'Fecha',
    sample: '09/05/2026',
    color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-500/30',
  },
  modulo: {
    label: 'Módulo',
    sample: 'Módulo 1',
    color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
  },
  codigo: {
    label: 'Código',
    sample: 'CERT-2026-ABC',
    color: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/30',
  },
  cursoTitulo: {
    label: 'Curso',
    sample: 'Módulo PESV Básico',
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  },
  tempPassword: {
    label: 'Contraseña Temporal',
    sample: '••••••••',
    color: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30',
  },
  resetUrl: {
    label: 'URL Reset',
    sample: 'https://plataforma.com/reset?token=...',
    color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
  },
  url_campus: {
    label: 'URL Campus',
    sample: 'https://plataforma.com/dashboard',
    color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
  },
  url_curso: {
    label: 'URL Curso',
    sample: 'https://plataforma.com/cursos/abc',
    color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
  },
  url_certificado: {
    label: 'URL Certificado',
    sample: 'https://plataforma.com/certificados',
    color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
  },
  url_monitoreo: {
    label: 'URL Monitoreo',
    sample: 'https://plataforma.com/monitoreo',
    color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
  },
  url_solicitudes: {
    label: 'URL Solicitudes',
    sample: 'https://plataforma.com/solicitudes',
    color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
  },
  url_calificaciones: {
    label: 'URL Calificaciones',
    sample: 'https://plataforma.com/calificaciones',
    color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
  },
  examinerNombre: {
    label: 'Examinador',
    sample: 'Prof. García',
    color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
  },
  adminNombre: {
    label: 'Admin',
    sample: 'Administrador',
    color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  },
  estudiante: {
    label: 'Estudiante',
    sample: 'María López',
    color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
  },
  solicitanteNombre: {
    label: 'Solicitante',
    sample: 'Carlos Rodríguez',
    color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
  },
  solicitanteEmail: {
    label: 'Email Solicitante',
    sample: 'carlos@correo.com',
    color: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-500/30',
  },
  solicitanteRol: {
    label: 'Rol Solicitado',
    sample: 'Capacitante',
    color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  },
  comentario: {
    label: 'Comentario',
    sample: 'Revisa la sección 3...',
    color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-500/30',
  },
  diasInactivo: {
    label: 'Días Inactivo',
    sample: '7',
    color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  },
  quizTitulo: {
    label: 'Quiz',
    sample: 'Cuestionario Final',
    color: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-500/30',
  },
  moduloTitulo: {
    label: 'Módulo',
    sample: 'Módulo 1',
    color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
  },
  nota: {
    label: 'Nota',
    sample: '2.5',
    color: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30',
  },
  remitente: {
    label: 'Remitente',
    sample: 'María López',
    color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
  },
  mensaje_preview: {
    label: 'Mensaje',
    sample: 'Hola, ¿cómo va tu progreso?',
    color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-500/30',
  },
  origen: {
    label: 'Asunto/Origen',
    sample: 'Mensaje directo',
    color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  },
  url_mensajes: {
    label: 'URL Mensajes',
    sample: 'https://plataforma.com/mensajes',
    color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
  },
  progreso_cursos: {
    label: 'Tabla Progreso',
    sample: '(tabla con cursos y porcentajes)',
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  },
};

const DEFAULT_COLOR = 'bg-slate-500/15 text-foreground border-slate-300 dark:border-slate-500/30';

function getVariableMeta(v: string) {
  return VARIABLE_META[v] || { label: v.replace(/_/g, ' '), sample: `[${v}]`, color: DEFAULT_COLOR };
}

/**
 * Renders a small pill/badge for a template variable.
 */
function VariablePill({ variable, size = 'sm' }: { variable: string; size?: 'sm' | 'md' }) {
  const meta = getVariableMeta(variable);
  const sizeClasses = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5';
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full border ${meta.color} ${sizeClasses} whitespace-nowrap`}
    >
      <AtSign className={size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5'} />
      {meta.label}
    </span>
  );
}

/**
 * Replaces {{variable}} in text with pill-badge HTML for preview rendering.
 */
function renderPreviewHtml(html: string, variables: string[]): string {
  let result = html;

  // 1st pass: Fix URL variables inside href attributes — replace with "#" so the
  //    button/link renders properly with its inline styles (white text on colored bg)
  for (const v of variables) {
    result = result.replace(new RegExp(`href=["']\\{\\{${v}\\}\\}["']`, 'g'), 'href="#"');
  }

  // 2nd pass: Replace remaining {{variables}} in visible text with styled pill badges
  for (const v of variables) {
    const meta = getVariableMeta(v);
    const badge = `<span style="display:inline-flex;align-items:center;gap:2px;padding:2px 8px;border-radius:99px;font-size:12px;font-weight:700;background:hsl(var(--primary) / 0.12);color:hsl(var(--primary));border:1px solid hsl(var(--primary) / 0.2)">${meta.sample}</span>`;
    result = result.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), badge);
  }
  return result;
}

/**
 * Renders a subject string replacing {{var}} with inline pill components.
 */
function SubjectWithPills({ text, variables }: { text: string; variables: string[] }) {
  const parts: (string | { variable: string })[] = [];
  let remaining = text;
  const regex = /\{\{(\w+)\}\}/g;
  let match;
  let lastIndex = 0;

  regex.lastIndex = 0;
  while ((match = regex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      parts.push(remaining.slice(lastIndex, match.index));
    }
    parts.push({ variable: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < remaining.length) {
    parts.push(remaining.slice(lastIndex));
  }

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          <span key={i}>{part}</span>
        ) : (
          <VariablePill key={i} variable={part.variable} size="sm" />
        ),
      )}
    </span>
  );
}

export { SubjectWithPills, VariablePill, getVariableMeta };

export default function MailTemplateEditor({ evento, plantilla, onSave, onCancel, isSaving }: MailTemplateEditorProps) {
  const [asunto, setAsunto] = useState(plantilla.asunto);
  const [cuerpoHtml, setCuerpoHtml] = useState(plantilla.cuerpo_html);
  const [showPreview, setShowPreview] = useState(false);

  const variablesArray: string[] = JSON.parse(evento.variables || '[]');

  const previewHtml = useMemo(() => renderPreviewHtml(cuerpoHtml, variablesArray), [cuerpoHtml, variablesArray]);
  const previewAsunto = useMemo(() => {
    let result = asunto;
    for (const v of variablesArray) {
      const meta = getVariableMeta(v);
      result = result.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), meta.sample);
    }
    return result;
  }, [asunto, variablesArray]);

  const handleSave = () => {
    onSave(plantilla.id, { asunto, cuerpo_html: cuerpoHtml });
  };

  const insertVariable = (variable: string) => {
    setCuerpoHtml((prev) => prev + ` {{${variable}}}`);
  };

  return (
    <div className="bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden flex flex-col h-full animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 border-b border-border/30 bg-muted/10 gap-3">
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              showPreview ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/80'
            }`}
          >
            {showPreview ? (
              <>
                <EyeOff className="h-4 w-4" /> Editar
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" /> Previsualizar
              </>
            )}
          </button>
          <button onClick={onCancel} className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Editor Area */}
        <div
          className={`flex-1 p-4 sm:p-6 overflow-y-auto ${showPreview ? 'hidden md:block opacity-50 pointer-events-none' : 'block'}`}
        >
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
                <Sparkles className="h-4 w-4 text-amber-500" /> Vista Previa con Datos de Ejemplo
              </h3>
              <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
                Así se verá el correo cuando llegue al destinatario. Las etiquetas se reemplazan automáticamente con
                datos reales.
              </p>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden text-slate-800">
                <div className="bg-primary p-4 text-white font-bold text-sm">
                  Asunto: {previewAsunto || 'Sin Asunto'}
                </div>
                <div
                  className="p-4 text-sm leading-relaxed email-preview-body"
                  onClick={(e) => {
                    // Prevent template variable links from navigating
                    const target = e.target as HTMLElement;
                    if (target.tagName === 'A' || target.closest('a')) {
                      e.preventDefault();
                    }
                  }}
                  dangerouslySetInnerHTML={sanitizeHTML(previewHtml)}
                />
                <style>{`
                  .email-preview-body a {
                    display: inline-block;
                    background: #4f46e5;
                    color: #fff !important;
                    font-weight: 700;
                    padding: 10px 24px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-size: 13px;
                    cursor: default;
                    margin: 4px 0;
                  }
                  .email-preview-body a:hover {
                    opacity: 0.9;
                  }
                `}</style>
              </div>
            </div>
          ) : (
            <div className="flex-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <AtSign className="h-4 w-4" /> Datos Automáticos
              </h3>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4">
                <p className="text-xs text-foreground mb-1 font-bold">¿Cómo funcionan?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Haz clic en una etiqueta para insertarla en el cuerpo del correo. Al enviar, el sistema reemplaza cada
                  etiqueta con la información real del destinatario.
                </p>
              </div>
              <div className="space-y-2">
                {variablesArray.map((v) => {
                  const meta = getVariableMeta(v);
                  return (
                    <button
                      key={v}
                      onClick={() => insertVariable(v)}
                      className="w-full text-left p-3 bg-card border border-border/50 rounded-xl hover:border-primary hover:bg-primary/5 transition-all group flex items-center gap-3 shadow-sm hover:shadow"
                    >
                      <VariablePill variable={v} size="md" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] text-muted-foreground block truncate">Ej: {meta.sample}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                        <Plus className="h-3 w-3" /> Insertar
                      </span>
                    </button>
                  );
                })}
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
          {isSaving ? (
            <span className="animate-pulse">Guardando...</span>
          ) : (
            <>
              <Save className="h-4 w-4" /> Guardar Cambios
            </>
          )}
        </button>
      </div>
    </div>
  );
}
