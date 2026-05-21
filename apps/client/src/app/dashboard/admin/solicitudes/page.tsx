'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  X,
  ShieldAlert,
  Clock,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Users,
} from 'lucide-react';
import { PageLoader } from '@/components/ui/PageLoader';
import { useRole } from '@/contexts/RoleContext';
import Link from 'next/link';
import api from '@/lib/api';
import { useAlert } from '@/contexts/AlertContext';
import { useWS } from '@/contexts/WebSocketContext';

// ── Tab types ──
type TabId = 'solicitudes' | 'registro-pesv';

// ── Bridge record type ──
interface BridgeRecord {
  id: number;
  pesv_infraccion_guid: string;
  pesv_conductor_guid: string;
  pesv_tipo_infraccion: string;
  pesv_conductor_nombre: string;
  pesv_conductor_email: string;
  pesv_fecha_infraccion: string;
  lms_usuario_guid?: string;
  lms_curso_guid?: string;
  lms_curso_titulo?: string;
  estado: 'MATRICULADO' | 'CURSO_NO_ENCONTRADO' | 'SUBSANADO' | 'ERROR';
  fecha_matriculacion?: string;
  fecha_subsanacion?: string;
  certificado_guid?: string;
  codigo_verificacion?: string;
  mensaje_error?: string;
  intentos_sync: number;
  pesv_actualizado: boolean;
  created_at: string;
}

interface BridgeStats {
  total: number;
  matriculados: number;
  subsanados: number;
  cursoNoEncontrado: number;
  errores: number;
  pesvConnected: boolean;
  bridgeEnabled: boolean;
}

// ── Estado badge component ──
function EstadoBadge({ estado }: { estado: BridgeRecord['estado'] }) {
  const config = {
    SUBSANADO: { label: 'Subsanado', cls: 'bg-emerald-500/10 text-emerald-500' },
    MATRICULADO: { label: 'Matriculado', cls: 'bg-blue-500/10 text-blue-500' },
    CURSO_NO_ENCONTRADO: { label: 'Curso Pendiente', cls: 'bg-amber-500/10 text-amber-500 animate-pulse' },
    ERROR: { label: 'Error', cls: 'bg-red-500/10 text-red-500' },
  }[estado];
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.cls}`}>
      {config.label}
    </span>
  );
}

// ── Stats Card ──
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="bg-card border border-border/50 rounded-xl p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg ${color} flex items-center justify-center shrink-0`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════

export default function SolicitudesYRegistro() {
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState<TabId>('solicitudes');

  // ── Solicitudes state ──
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loadingSol, setLoadingSol] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const { showAlert } = useAlert();
  const { subscribe } = useWS();

  // ── Bridge state ──
  const [registros, setRegistros] = useState<BridgeRecord[]>([]);
  const [stats, setStats] = useState<BridgeStats | null>(null);
  const [loadingBridge, setLoadingBridge] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('');

  // ── Fetch solicitudes ──
  useEffect(() => {
    if (role === 'admin') fetchSolicitudes();
  }, [role]);

  useEffect(() => {
    if (role !== 'admin') return;
    const unsub1 = subscribe('request:new', fetchSolicitudes);
    const unsub2 = subscribe('request:resolved', fetchSolicitudes);
    return () => {
      unsub1();
      unsub2();
    };
  }, [role, subscribe]);

  const fetchSolicitudes = async () => {
    try {
      const res = await api.get('/auth/solicitudes');
      setSolicitudes(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSol(false);
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

  // ── Fetch bridge data ──
  useEffect(() => {
    if (role === 'admin' && activeTab === 'registro-pesv') fetchBridgeData();
  }, [role, activeTab]);

  useEffect(() => {
    if (role !== 'admin') return;
    const unsub1 = subscribe('pesv-bridge:sync', () => fetchBridgeData());
    const unsub2 = subscribe('pesv-bridge:subsanacion', () => fetchBridgeData());
    const unsub3 = subscribe('dashboard:refresh', (data: any) => {
      if (data?.reason?.startsWith('pesv_')) fetchBridgeData();
    });
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [role, subscribe]);

  const fetchBridgeData = async () => {
    try {
      const params = new URLSearchParams();
      if (filterEstado) params.set('estado', filterEstado);
      if (searchTerm) params.set('search', searchTerm);
      const [regRes, statsRes] = await Promise.all([
        api.get(`/pesv-bridge/registros?${params.toString()}`),
        api.get('/pesv-bridge/stats'),
      ]);
      setRegistros(regRes.data.registros || []);
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBridge(false);
    }
  };

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/pesv-bridge/sync');
      showAlert.success('Sincronización completada', `${res.data.processed} procesados, ${res.data.errors} errores.`);
      fetchBridgeData();
    } catch (err) {
      console.error(err);
      showAlert.error('Error', 'No se pudo completar la sincronización.');
    } finally {
      setSyncing(false);
    }
  };

  // Re-fetch bridge when filters change
  useEffect(() => {
    if (role === 'admin' && activeTab === 'registro-pesv') {
      setLoadingBridge(true);
      fetchBridgeData();
    }
  }, [filterEstado, searchTerm]);

  // ── Access control ──
  if (role !== 'admin') {
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

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-700">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Solicitudes y Registro</h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
          Gestione solicitudes de acceso y monitoree la integración con el sistema PESV.
        </p>
      </header>

      {/* ── TABS ── */}
      <div className="flex gap-1 mb-6 bg-muted/30 p-1 rounded-xl border border-border/30 w-fit">
        <button
          onClick={() => setActiveTab('solicitudes')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'solicitudes'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Solicitudes
          {solicitudes.length > 0 && (
            <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full text-[10px] font-bold">
              {solicitudes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('registro-pesv')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'registro-pesv'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Registro PESV
          {stats && stats.cursoNoEncontrado > 0 && (
            <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse">
              {stats.cursoNoEncontrado}
            </span>
          )}
        </button>
      </div>

      {/* ═══ TAB: SOLICITUDES ═══ */}
      {activeTab === 'solicitudes' && (
        <>
          {loadingSol ? (
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
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            sol.rol_pedido === 'ADMINISTRADOR'
                              ? 'bg-red-500/10 text-red-500'
                              : sol.rol_pedido === 'PROFESOR'
                                ? 'bg-blue-500/10 text-blue-500'
                                : 'bg-emerald-500/10 text-emerald-500'
                          }`}
                        >
                          {sol.rol_pedido}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmtDate(sol.created_at)}
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
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ml-2 ${
                          sol.rol_pedido === 'ADMINISTRADOR'
                            ? 'bg-red-500/10 text-red-500'
                            : sol.rol_pedido === 'PROFESOR'
                              ? 'bg-blue-500/10 text-blue-500'
                              : 'bg-emerald-500/10 text-emerald-500'
                        }`}
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
                        <Clock className="h-3 w-3" /> {fmtDate(sol.created_at)}
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
        </>
      )}

      {/* ═══ TAB: REGISTRO PESV ═══ */}
      {activeTab === 'registro-pesv' && (
        <>
          {/* Stats cards */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              <StatCard label="Total Registros" value={stats.total} icon={Users} color="bg-primary/10 text-primary" />
              <StatCard
                label="Matriculados"
                value={stats.matriculados}
                icon={BookOpen}
                color="bg-blue-500/10 text-blue-500"
              />
              <StatCard
                label="Subsanados"
                value={stats.subsanados}
                icon={CheckCircle2}
                color="bg-emerald-500/10 text-emerald-500"
              />
              <StatCard
                label="Curso Pendiente"
                value={stats.cursoNoEncontrado}
                icon={AlertTriangle}
                color="bg-amber-500/10 text-amber-500"
              />
              <StatCard label="Errores" value={stats.errores} icon={X} color="bg-red-500/10 text-red-500" />
            </div>
          )}

          {/* Connection status + actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              {stats && (
                <div className="flex items-center gap-2 text-xs">
                  <span className={`h-2 w-2 rounded-full ${stats.pesvConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="text-muted-foreground">
                    PESV {stats.pesvConnected ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar conductor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-56 pl-9 pr-3 py-2 bg-card border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {/* Filter */}
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="px-3 py-2 bg-card border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Todos</option>
                <option value="MATRICULADO">Matriculados</option>
                <option value="SUBSANADO">Subsanados</option>
                <option value="CURSO_NO_ENCONTRADO">Curso Pendiente</option>
                <option value="ERROR">Error</option>
              </select>
              {/* Sync button */}
              <button
                onClick={handleForceSync}
                disabled={syncing}
                className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sincronizar</span>
              </button>
            </div>
          </div>

          {/* Bridge records table */}
          {loadingBridge ? (
            <PageLoader message="Cargando registros PESV..." />
          ) : registros.length === 0 ? (
            <div className="bg-card border border-border/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
              <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-bold">Sin Registros</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                No hay infracciones sincronizadas del sistema PESV. Los registros aparecerán automáticamente cuando se
                detecten nuevas infracciones.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
              {/* Desktop table */}
              <table className="hidden lg:table w-full text-left text-sm">
                <thead className="bg-muted/30 border-b border-border/50 uppercase text-xs font-bold text-muted-foreground">
                  <tr>
                    <th className="px-5 py-4">Conductor</th>
                    <th className="px-5 py-4">Tipo Infracción</th>
                    <th className="px-5 py-4">Curso Asignado</th>
                    <th className="px-5 py-4">Estado</th>
                    <th className="px-5 py-4">Fecha Infracción</th>
                    <th className="px-5 py-4">Subsanación</th>
                    <th className="px-5 py-4">PESV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {registros.map((r) => (
                    <tr
                      key={r.id}
                      className={`hover:bg-muted/10 transition-colors ${r.estado === 'CURSO_NO_ENCONTRADO' ? 'bg-amber-500/[0.03]' : ''}`}
                    >
                      <td className="px-5 py-4">
                        <p className="font-bold text-sm">{r.pesv_conductor_nombre}</p>
                        <p className="text-xs text-muted-foreground">{r.pesv_conductor_email}</p>
                      </td>
                      <td className="px-5 py-4 text-sm">{r.pesv_tipo_infraccion}</td>
                      <td className="px-5 py-4 text-sm">
                        {r.lms_curso_titulo || <span className="text-muted-foreground italic">Sin asignar</span>}
                      </td>
                      <td className="px-5 py-4">
                        <EstadoBadge estado={r.estado} />
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{fmtDate(r.pesv_fecha_infraccion)}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {r.fecha_subsanacion ? fmtDateTime(r.fecha_subsanacion) : '—'}
                      </td>
                      <td className="px-5 py-4 text-sm">
                        {r.estado === 'SUBSANADO' ? (
                          r.pesv_actualizado ? (
                            <span className="text-emerald-500 text-xs font-bold">✓ Actualizado</span>
                          ) : (
                            <span className="text-amber-500 text-xs font-bold">⏳ Pendiente</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile card view */}
              <div className="lg:hidden divide-y divide-border/30">
                {registros.map((r) => (
                  <div
                    key={r.id}
                    className={`p-4 space-y-2 ${r.estado === 'CURSO_NO_ENCONTRADO' ? 'bg-amber-500/[0.03]' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{r.pesv_conductor_nombre}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.pesv_conductor_email}</p>
                      </div>
                      <EstadoBadge estado={r.estado} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{r.pesv_tipo_infraccion}</span>
                      <span>{fmtDate(r.pesv_fecha_infraccion)}</span>
                    </div>
                    {r.lms_curso_titulo && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Curso:</span> {r.lms_curso_titulo}
                      </p>
                    )}
                    {r.fecha_subsanacion && (
                      <p className="text-xs text-emerald-500">
                        ✓ Subsanado: {fmtDateTime(r.fecha_subsanacion)}
                        {r.pesv_actualizado ? ' · PESV actualizado' : ' · PESV pendiente'}
                      </p>
                    )}
                    {r.estado === 'ERROR' && r.mensaje_error && (
                      <p className="text-xs text-red-400 italic">{r.mensaje_error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
