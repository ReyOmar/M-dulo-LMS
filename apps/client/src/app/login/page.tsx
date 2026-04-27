"use client";

import { useState } from "react";
import { Lock, Mail, ArrowRight, GraduationCap, ShieldCheck, User } from "lucide-react";
import { PageLoader } from "@/components/PageLoader";
import { useRouter } from "next/navigation";
import { useRole } from "@/contexts/RoleContext";
import { useConfig } from "@/contexts/ConfigContext";
import api from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { syncSession } = useRole();
  const { config } = useConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [rolPedido, setRolPedido] = useState("ESTUDIANTE");

  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [view, setView] = useState<"LOGIN" | "SETUP_PASSWORD" | "REQUEST_ACCESS" | "REQUEST_SUCCESS">("LOGIN");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setErrorMsg("");

      try {
        const { data } = await api.post("/auth/login", { email, contrasena: password });
        
        if (data.requireSetup) {
            setSuccessMsg(data.message);
            setView("SETUP_PASSWORD");
            return;
        }

        // Sync context and redirect
        syncSession(data.token, data.user);
        setRedirecting(true);
        router.push("/dashboard");

      } catch (err: any) {
          setErrorMsg(err.response?.data?.message || err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleSetupPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setErrorMsg("");

      try {
        await api.post("/auth/establecer-password", { email, nuevaContrasena: newPassword });
  
        // Iniciar sesión automáticamente después de establecerla
        await handleLogin({ preventDefault: () => {} } as React.FormEvent);

      } catch (err: any) {
          setErrorMsg(err.response?.data?.message || err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setErrorMsg("");

      try {
        await api.post("/auth/solicitar", { email, nombre, apellido, rol_pedido: rolPedido });
        setView("REQUEST_SUCCESS");

      } catch (err: any) {
          setErrorMsg(err.response?.data?.message || err.message);
      } finally {
          setLoading(false);
      }
  };

  if (redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <PageLoader message="Ingresando al campus..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 transition-colors relative overflow-hidden">
        {/* Dynamic Background - custom image or abstract blobs */}
        {config?.login_fondo_url ? (
          <img src={config.login_fondo_url} alt="" className="absolute inset-0 w-full h-full object-cover -z-10 opacity-40" />
        ) : (
          <>
            <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/20 blur-[100px] -z-10" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-secondary/30 blur-[100px] -z-10" />
          </>
        )}

      <div className="w-full max-w-md bg-card border border-border/50 rounded-3xl shadow-xl p-8 relative z-10 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2 ring-1 ring-primary/20">
            {view === "SETUP_PASSWORD" ? <ShieldCheck className="h-7 w-7 text-emerald-500" /> : <GraduationCap className="h-7 w-7 text-primary" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
                {view === "LOGIN" && (config?.mensaje_bienvenida || "Bienvenido PESV")}
                {view === "SETUP_PASSWORD" && "Aprobado: Setup Guardián"}
                {view === "REQUEST_ACCESS" && "Solicitar Acceso Privado"}
                {view === "REQUEST_SUCCESS" && "Petición en Tránsito"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
                {view === "LOGIN" && "Ingresa tus credenciales para ser validado en base de datos."}
                {view === "SETUP_PASSWORD" && "Tu cuenta fue dada de alta por la Administración. Ingresa una contraseña personal y secreta solo para ti."}
                {view === "REQUEST_ACCESS" && "Registro cerrado. Envía tu información para que la administración determine tu pase."}
                {view === "REQUEST_SUCCESS" && "Tu petición se ha encolado en los servidores de la administración."}
            </p>
          </div>
        </div>

        {errorMsg && (
            <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-semibold max-w-full text-center">
                {errorMsg}
            </div>
        )}
        
        {successMsg && view === "SETUP_PASSWORD" && (
            <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-sm font-semibold max-w-full text-center">
                {successMsg}
            </div>
        )}

        {/* ===================== VIEW: LOGIN ===================== */}
        {view === "LOGIN" && (
            <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Correo Módulo PESV</label>
                    <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <input
                        type="email"
                        placeholder="admin@pesv.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="flex h-11 w-full rounded-xl border border-input bg-background/50 pl-11 pr-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                    </div>
                </div>
                
                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Contraseña</label>
                    <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <input
                        type="password"
                        placeholder="Tu clave secreta"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="flex h-11 w-full rounded-xl border border-input bg-background/50 pl-11 pr-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    </div>
                </div>
            </div>

            <button type="submit" disabled={loading} className="group relative inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-all hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70">
                {loading ? "Validando..." : "Ingresar Seguro"}
            </button>
            </form>
        )}

        {/* ===================== VIEW: SETUP INITIAL PASSWORD ===================== */}
        {view === "SETUP_PASSWORD" && (
            <form onSubmit={handleSetupPassword} className="space-y-6 animate-in slide-in-from-bottom-4">
            <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Nueva Contraseña Secreta</label>
                <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-emerald-500" />
                <input
                    type="password"
                    placeholder="Minimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="flex h-11 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/5 pl-11 pr-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
                </div>
            </div>
            
            <button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-emerald-600 px-8 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-70">
                {loading ? "Encriptando..." : "Firmar e Ingresar"}
            </button>
            </form>
        )}

        {/* ===================== VIEW: REQUEST ACCESS ===================== */}
        {view === "REQUEST_ACCESS" && (
            <form onSubmit={handleRequestAccess} className="space-y-4 animate-in fade-in">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Nombre</label>
                    <input type="text" value={nombre} onChange={e=>setNombre(e.target.value)} required className="w-full h-10 rounded-lg border border-input pl-3 text-sm focus-visible:ring-2 focus-visible:ring-primary" />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Apellido</label>
                    <input type="text" value={apellido} onChange={e=>setApellido(e.target.value)} required className="w-full h-10 rounded-lg border border-input pl-3 text-sm focus-visible:ring-2 focus-visible:ring-primary" />
                </div>
            </div>
            
            <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Correo Electrónico a Validar</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="w-full h-10 rounded-lg border border-input pl-3 text-sm focus-visible:ring-2 focus-visible:ring-primary" />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Cargo Pedido (Para Asignaciones)</label>
                <select value={rolPedido} onChange={e=>setRolPedido(e.target.value)} className="w-full h-10 rounded-lg border border-input pl-3 text-sm focus-visible:ring-2 focus-visible:ring-primary bg-background">
                    <option value="ESTUDIANTE">Personal Capacitante / Alumno</option>
                    <option value="PROFESOR">Examinador / Supervisor</option>
                    <option value="ADMINISTRADOR">Administrador Maestro</option>
                </select>
            </div>
            
            <div className="flex gap-2 mt-6">
                <button type="button" onClick={() => setView("LOGIN")} className="h-10 px-4 text-xs font-bold text-muted-foreground rounded-lg border border-border hover:bg-muted">Cerrar</button>
                <button type="submit" disabled={loading} className="flex-1 h-10 rounded-lg bg-primary text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-70">
                    {loading ? "Elevando Petición..." : "Solicitar a Prevención"}
                </button>
            </div>
            </form>
        )}

        {/* ===================== VIEW: SUCCESS REQUEST ===================== */}
        {view === "REQUEST_SUCCESS" && (
            <div className="flex flex-col items-center text-center animate-in zoom-in-95">
                <div className="text-emerald-500 font-bold bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 mb-6">
                    Misión Completa. Cuando el administrador acepte la solicitud, intenta iniciar sesión con tu correo aquí para configurar tu contraseña.
                </div>
                <button onClick={() => setView("LOGIN")} className="h-11 w-full rounded-xl bg-card border border-border hover:bg-muted font-bold text-sm shadow-sm transition-colors">
                    Volver al Inicio
                </button>
            </div>
        )}

        {/* Footer Toggle */}
        {(view === "LOGIN") && (
            <div className="mt-8 pt-6 border-t border-border flex justify-center items-center">
            <button onClick={() => setView("REQUEST_ACCESS")} className="text-xs font-bold text-primary hover:underline flex items-center gap-2">
                <User className="h-4 w-4" /> Registrar Petición de Monitoreo
            </button>
            </div>
        )}
      </div>
    </div>
  );
}
