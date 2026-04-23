"use client";

import { useEffect, useState } from "react";
import { Check, X, ShieldAlert, Clock } from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import Link from "next/link";

export default function SolicitudesPendientes() {
  const { realRole } = useRole();
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    fetchSolicitudes();
  }, []);

  const fetchSolicitudes = async () => {
    try {
      const res = await fetch("http://localhost:3200/api/auth/solicitudes");
      const data = await res.json();
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
      await fetch(`http://localhost:3200/api/auth/solicitudes/${id}/${action}`, { method: "POST" });
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
        <p className="text-muted-foreground mt-2">Revise y valide las solicitudes de registro manualmente para mantener la integridad del sistema (JWT Control). <br/>Al aprobar, se asignará la clave temporal: <strong className="text-foreground">pesvauth2026</strong> a la cuenta.</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-40">
           <span className="text-muted-foreground font-bold">Cargando base de datos...</span>
        </div>
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
