'use client';

import { useEffect, useState } from 'react';
import { Check, X, ShieldAlert, Clock, Loader2 } from 'lucide-react';
import { PageLoader } from '@/components/ui/PageLoader';
import { useRole } from '@/contexts/RoleContext';
import Link from 'next/link';
import api from '@/lib/api';
import { useAlert } from '@/contexts/AlertContext';
import { useWS } from '@/contexts/WebSocketContext';

export default function SolicitudesPendientes() {
  const { realRole } = useRole();
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const { showAlert } = useAlert();
  const { subscribe } = useWS();

  useEffect(() => {
    if (realRole === 'admin') {
      fetchSolicitudes();
    }
  }, [realRole]);

  useEffect(() => {
    if (realRole !== 'admin') return;

    // Subscribe to new requests or resolutions to auto-update the list
    const unsub1 = subscribe('request:new', fetchSolicitudes);
    const unsub2 = subscribe('request:resolved', fetchSolicitudes);

    return () => {
      unsub1();
      unsub2();
    };
  }, [realRole, subscribe]);

  const fetchSolicitudes = async () => {
    try {
      const res = await api.get('/auth/solicitudes');
      const data = res.data;
      setSolicitudes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: number, action: 'aprobar' | 'rechazar') => {
    setProcessing(id);
    try {
      await api.post(`/auth/solicitudes/${id}/${action}`);
      setSolicitudes(solicitudes.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  if (realRole !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] animate-in fade-in">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold">Acceso Restringido PESV</h1>
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

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-700">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3 flex-wrap">
          Solicitudes de Acceso{' '}
          <span className="bg-amber-500/10 text-amber-500 px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
            {solicitudes.length} Pendientes
          </span>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
          Revise y valide las solicitudes de registro manualmente.{' '}
          <span className="hidden sm:inline">
            Al aprobar, el usuario recibirá un correo y deberá configurar su contraseña en el primer inicio de sesión.
          </span>
        </p>
      </header>

      {/* ===== TABLA DE SOLICITUDES ===== */}
      {loading ? (
        <PageLoader message="Cargando solicitudes..." />
      ) : solicitudes.length === 0 ? (
        <div className="bg-card border border-border/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
          <Check className="h-16 w-16 text-emerald-500 mb-4 opacity-50" />
          <h3 className="text-xl font-bold">Bandeja Limpia</h3>
          <p className="text-muted-foreground mt-2 max-w-md">
            No hay solicitudes de registro pendientes. Toda la red académica está operando con normalidad.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          {/* Desktop table */}
          <table className="hidden lg:table w-full text-left text-sm">
            <thead className="bg-muted/30 border-b border-border/50 uppercase text-xs font-bold text-muted-foreground">
              <tr>
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Correo</th>
                <th className="px-6 py-4">Rol Solicitado</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {solicitudes.map((sol) => (
                <tr key={sol.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-6 py-4 font-bold">
                    {sol.nombre} {sol.apellido}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{sol.email}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                        ${
                          sol.rol_pedido === 'ADMINISTRADOR'
                            ? 'bg-red-500/10 text-red-500'
                            : sol.rol_pedido === 'PROFESOR'
                              ? 'bg-blue-500/10 text-blue-500'
                              : 'bg-emerald-500/10 text-emerald-500'
                        }
                    `}
                    >
                      {sol.rol_pedido}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />{' '}
                    {new Date(sol.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleAction(sol.id, 'aprobar')}
                      disabled={processing === sol.id}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                      title="Aprobar"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleAction(sol.id, 'rechazar')}
                      disabled={processing === sol.id}
                      className="bg-destructive hover:bg-destructive/90 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                      title="Rechazar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile card view */}
          <div className="lg:hidden divide-y divide-border/30">
            {solicitudes.map((sol) => (
              <div key={sol.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">
                      {sol.nombre} {sol.apellido}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{sol.email}</p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ml-2
                      ${
                        sol.rol_pedido === 'ADMINISTRADOR'
                          ? 'bg-red-500/10 text-red-500'
                          : sol.rol_pedido === 'PROFESOR'
                            ? 'bg-blue-500/10 text-blue-500'
                            : 'bg-emerald-500/10 text-emerald-500'
                      }
                  `}
                  >
                    {sol.rol_pedido === 'PROFESOR'
                      ? 'Examinador'
                      : sol.rol_pedido === 'ESTUDIANTE'
                        ? 'Capacitante'
                        : 'Admin'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />{' '}
                    {new Date(sol.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction(sol.id, 'aprobar')}
                      disabled={processing === sol.id}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 text-xs font-bold flex items-center gap-1"
                    >
                      <Check className="h-3.5 w-3.5" /> Aprobar
                    </button>
                    <button
                      onClick={() => handleAction(sol.id, 'rechazar')}
                      disabled={processing === sol.id}
                      className="bg-destructive hover:bg-destructive/90 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 text-xs font-bold flex items-center gap-1"
                    >
                      <X className="h-3.5 w-3.5" /> Rechazar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
