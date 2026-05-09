'use client';

import { useEffect, useState } from 'react';
import { Mail, ShieldAlert, Power, LayoutTemplate, Activity, Edit3 } from 'lucide-react';
import { PageLoader } from '@/components/ui/PageLoader';
import { useRole } from '@/contexts/RoleContext';
import Link from 'next/link';
import api from '@/lib/api';
import { useAlert } from '@/contexts/AlertContext';
import MailTemplateEditor, { SubjectWithPills } from './components/MailTemplateEditor';

interface Plantilla {
  id: number;
  nombre_interno: string;
  asunto: string;
  cuerpo_html: string;
  activo: boolean;
  es_sistema: boolean;
}

interface Evento {
  id: number;
  identificador: string;
  nombre_legible: string;
  descripcion: string;
  variables: string;
  plantillas: Plantilla[];
}

export default function BaseCorreos() {
  const { realRole } = useRole();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlantilla, setEditingPlantilla] = useState<{ evento: Evento; plantilla: Plantilla } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { showAlert, showToast } = useAlert();

  useEffect(() => {
    if (realRole === 'admin') {
      fetchEventos();
    }
  }, [realRole]);

  const fetchEventos = async () => {
    try {
      const res = await api.get('/mail-templates/eventos');
      setEventos(res.data);
    } catch (err) {
      console.error(err);
      showAlert.error('Error', 'No se pudieron cargar los eventos de correo.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActivo = async (plantillaId: number, currentStatus: boolean) => {
    try {
      await api.put(`/mail-templates/${plantillaId}`, { activo: !currentStatus });
      fetchEventos();
    } catch (err) {
      console.error(err);
      showAlert.error('Error', 'No se pudo cambiar el estado de la plantilla.');
    }
  };

  const handleSaveTemplate = async (id: number, data: { asunto: string; cuerpo_html: string }) => {
    setIsSaving(true);
    try {
      await api.put(`/mail-templates/${id}`, data);
      showToast.success('Plantilla guardada correctamente.');
      setEditingPlantilla(null);
      fetchEventos();
    } catch (err) {
      console.error(err);
      showAlert.error('Error', 'No se pudo guardar la plantilla.');
    } finally {
      setIsSaving(false);
    }
  };

  if (realRole !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] animate-in fade-in">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold">Acceso Restringido</h1>
        <p className="text-muted-foreground mt-2">Área exclusiva para Administradores de Sistema.</p>
        <Link
          href="/dashboard"
          className="mt-6 px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors"
        >
          Volver al Tablero
        </Link>
      </div>
    );
  }

  if (editingPlantilla) {
    return (
      <div className="h-[calc(100vh-8rem)]">
        <MailTemplateEditor
          evento={editingPlantilla.evento}
          plantilla={editingPlantilla.plantilla}
          onSave={handleSaveTemplate}
          onCancel={() => setEditingPlantilla(null)}
          isSaving={isSaving}
        />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-700">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Mail className="h-8 w-8 text-primary" />
            Gestión de Correos
          </h1>
          <p className="text-muted-foreground mt-2">
            Administra y personaliza las notificaciones automáticas que envía la plataforma.
          </p>
        </div>
      </header>

      {loading ? (
        <PageLoader message="Cargando configuración de correos..." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-6 duration-500">
          {eventos.map((evento) => (
            <div
              key={evento.id}
              className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{evento.nombre_legible}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{evento.identificador}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-6 flex-1">{evento.descripcion}</p>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                  <LayoutTemplate className="h-4 w-4" /> Plantillas Configuradas
                </h4>
                {evento.plantillas.map((plantilla) => (
                  <div
                    key={plantilla.id}
                    className="flex items-center justify-between p-3 bg-muted/20 border border-border/30 rounded-xl"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">
                        <SubjectWithPills text={plantilla.asunto} variables={JSON.parse(evento.variables || '[]')} />
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{plantilla.nombre_interno}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <button
                        onClick={() => setEditingPlantilla({ evento, plantilla })}
                        className="p-2 bg-card hover:bg-muted border border-border/50 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                        title="Editar Plantilla"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActivo(plantilla.id, plantilla.activo)}
                        className={`p-2 border rounded-lg transition-colors flex items-center justify-center ${plantilla.activo ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20' : 'bg-muted border-border/50 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20'}`}
                        title={plantilla.activo ? 'Desactivar Envío' : 'Activar Envío'}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {evento.plantillas.length === 0 && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold text-center">
                    No hay plantillas para este evento.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
