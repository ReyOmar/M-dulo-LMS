"use client";

import { useEffect, useState } from "react";
import { Check, X, ShieldAlert, Clock, KeyRound, Eye, EyeOff, Save, Loader2 } from "lucide-react";
import { PageLoader } from "@/components/PageLoader";
import { useRole } from "@/contexts/RoleContext";
import Link from "next/link";
import api from "@/lib/api";

export default function SolicitudesPendientes() {
  const { realRole } = useRole();
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);

  // Default password state
  const [defaultPassword, setDefaultPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    fetchSolicitudes();
    fetchDefaultPassword();
  }, []);

  const fetchSolicitudes = async () => {
    try {
      const res = await api.get("/auth/solicitudes");
      const data = res.data;
      setSolicitudes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDefaultPassword = async () => {
    try {
      const res = await api.get("/configuracion");
      const data = res.data;
      setDefaultPassword(data?.contrasena_defecto || "pesvauth2026");
      setNewPassword(data?.contrasena_defecto || "pesvauth2026");
    } catch (err) {
      console.error(err);
    }
  };

  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setSavingPassword(true);
    try {
      await api.post("/configuracion", { contrasena_defecto: newPassword });
      setDefaultPassword(newPassword);
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Error al guardar la contraseña.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAction = async (id: number, action: 'aprobar' | 'rechazar') => {
    setProcessing(id);
    try {
      await api.post(`/auth/solicitudes/${id}/${action}`);
      setSolicitudes(solicitudes.filter(s => s.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  if (realRole !== "admin") {
      return (
          <div className="flex flex-col items-center justify-center h-[70vh] animate-in fade-in">
              <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
              <h1 className="text-2xl font-bold">Acceso Restringido PESV</h1>
              <p className="text-muted-foreground mt-2">Área exclusiva para Administradores de Sistema.</p>
              <Link href="/dashboard" className="mt-6 px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors">Volver al Tablero</Link>
          </div>
      );
  }

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          Solicitudes de Acceso <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-sm font-bold">{solicitudes.length} Pendientes</span>
        </h1>
        <p className="text-muted-foreground mt-2">Revise y valide las solicitudes de registro manualmente para mantener la integridad del sistema (JWT Control). <br/>Al aprobar, se asignará la clave temporal configurada abajo a la cuenta.</p>
      </header>

      {/* ===== CONTRASEÑA POR DEFECTO ===== */}
      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-border/50 bg-muted/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <KeyRound className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h2 className="font-bold text-sm">Contraseña por Defecto</h2>
            <p className="text-xs text-muted-foreground">Esta contraseña se asignará automáticamente a cada usuario nuevo aprobado.</p>
          </div>
        </div>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex-1 w-full sm:max-w-md">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                Contraseña temporal para nuevos usuarios
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-mono text-sm"
                  placeholder="Ingresa la contraseña por defecto..."
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Mínimo 6 caracteres. Los usuarios deberán cambiarla en su primer inicio de sesión.
              </p>
            </div>
            <button
              onClick={handleSavePassword}
              disabled={savingPassword || newPassword === defaultPassword || newPassword.length < 6}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm whitespace-nowrap
                ${passwordSaved 
                  ? 'bg-emerald-500 text-white' 
                  : newPassword !== defaultPassword && newPassword.length >= 6
                    ? 'bg-amber-500 hover:bg-amber-600 text-white hover:-translate-y-0.5'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
            >
              {savingPassword ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
              ) : passwordSaved ? (
                <><Check className="h-4 w-4" /> ¡Guardada!</>
              ) : (
                <><Save className="h-4 w-4" /> Guardar Contraseña</>
              )}
            </button>
          </div>
          {newPassword !== defaultPassword && newPassword.length >= 6 && (
            <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-sm text-amber-600 dark:text-amber-400 font-medium animate-in fade-in duration-300">
              ⚠️ Has modificado la contraseña. Presiona <strong>&quot;Guardar Contraseña&quot;</strong> para que los próximos usuarios aprobados reciban esta nueva clave.
            </div>
          )}
        </div>
      </div>

      {/* ===== TABLA DE SOLICITUDES ===== */}
      {loading ? (
        <PageLoader message="Cargando solicitudes..." />
      ) : solicitudes.length === 0 ? (
        <div className="bg-card border border-border/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
            <Check className="h-16 w-16 text-emerald-500 mb-4 opacity-50" />
            <h3 className="text-xl font-bold">Bandeja Limpia</h3>
            <p className="text-muted-foreground mt-2 max-w-md">No hay solicitudes de registro pendientes. Toda la red académica está operando con normalidad.</p>
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 border-b border-border/50 uppercase text-xs font-bold text-muted-foreground">
              <tr>
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Correo</th>
                <th className="px-6 py-4">Rol Solicitado</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4 text-right">Acción P.E.S.V.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {solicitudes.map(sol => (
                <tr key={sol.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-6 py-4 font-bold">{sol.nombre} {sol.apellido}</td>
                  <td className="px-6 py-4 text-muted-foreground">{sol.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                        ${sol.rol_pedido === 'ADMINISTRADOR' ? 'bg-red-500/10 text-red-500' : 
                          sol.rol_pedido === 'PROFESOR' ? 'bg-blue-500/10 text-blue-500' : 
                          'bg-emerald-500/10 text-emerald-500'}
                    `}>
                        {sol.rol_pedido}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {new Date(sol.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={() => handleAction(sol.id, 'aprobar')}
                      disabled={processing === sol.id}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                      title="Aprobar y generar credenciales"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleAction(sol.id, 'rechazar')}
                      disabled={processing === sol.id}
                      className="bg-destructive hover:bg-destructive/90 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                      title="Rechazar y purgar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
