"use client";

import { useState, Suspense } from "react";
import { Lock, ArrowLeft, Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/restablecer-contrasena", { token, nuevaContrasena: password });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center p-8">
        <p className="text-red-500 font-bold">Enlace inválido</p>
        <p className="text-muted-foreground text-sm mt-2">No se encontró un token de recuperación en la URL.</p>
        <Link href="/recuperar-contrasena" className="inline-flex items-center gap-2 mt-4 text-primary font-bold text-sm hover:underline">
          Solicitar uno nuevo
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8">
      {success ? (
        <div className="text-center animate-in fade-in duration-300">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full mx-auto flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold mb-2">¡Contraseña Restablecida!</h3>
          <p className="text-muted-foreground text-sm">Tu contraseña ha sido actualizada exitosamente. Ya puedes iniciar sesión.</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 mt-6 bg-primary text-white font-bold py-3 px-8 rounded-xl hover:bg-primary/90 transition-colors text-sm"
          >
            Ir a Iniciar Sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold mb-2">Nueva Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                required
                minLength={6}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Confirmar Contraseña</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm font-medium bg-red-500/10 px-4 py-2 rounded-xl">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Actualizando...
              </>
            ) : (
              "Restablecer Contraseña"
            )}
          </button>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground font-medium inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio de sesión
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function RestablecerContrasenaPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary/80 p-8 text-center">
            <div className="w-16 h-16 bg-white/10 rounded-2xl mx-auto flex items-center justify-center mb-4 backdrop-blur-sm">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Nueva Contraseña</h1>
            <p className="text-white/70 text-sm mt-2">
              Crea una nueva contraseña segura para tu cuenta.
            </p>
          </div>

          {/* Body */}
          <Suspense fallback={<div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
