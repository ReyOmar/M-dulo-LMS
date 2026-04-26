"use client";

import { useEffect, useState } from "react";
import { X, User, Mail, Lock, Save, Loader2, CheckCircle, AlertCircle, Shield, Eye, EyeOff } from "lucide-react";
import { useRole } from "@/contexts/RoleContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UserSettingsModal({ open, onClose }: Props) {
  const { user, syncSession } = useRole();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [contrasenaActual, setContrasenaActual] = useState('');
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (open && user?.guid) {
      fetchProfile();
    }
  }, [open, user?.guid]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3200/api/auth/perfil/${user.guid}`);
      const data = await res.json();
      setProfileData(data);
      setNombre(data.nombre || '');
      setApellido(data.apellido || '');
      setEmail(data.email || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validations
    if (!nombre.trim() || !apellido.trim() || !email.trim()) {
      showFeedback('error', 'Nombre, apellido y correo son obligatorios.');
      return;
    }
    if (nuevaContrasena && nuevaContrasena !== confirmarContrasena) {
      showFeedback('error', 'Las contraseñas no coinciden.');
      return;
    }
    if (nuevaContrasena && nuevaContrasena.length < 6) {
      showFeedback('error', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setSaving(true);
    try {
      const body: any = { nombre: nombre.trim(), apellido: apellido.trim(), email: email.trim() };
      if (nuevaContrasena) {
        body.contrasena_actual = contrasenaActual;
        body.nueva_contrasena = nuevaContrasena;
      }

      const res = await fetch(`http://localhost:3200/api/auth/perfil/${user.guid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        showFeedback('error', data.message || 'Error al guardar.');
        return;
      }

      // Sync session with updated data
      if (data.user) {
        const token = localStorage.getItem('lms_token') || '';
        syncSession(token, { ...user, nombre: data.user.nombre, apellido: data.user.apellido });
      }

      showFeedback('success', 'Perfil actualizado exitosamente.');
      setContrasenaActual('');
      setNuevaContrasena('');
      setConfirmarContrasena('');
    } catch (err) {
      showFeedback('error', 'Error de conexión.');
    } finally {
      setSaving(false);
    }
  };

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const getRolLabel = (rol: string) => {
    if (rol === 'ADMINISTRADOR') return { label: 'Administrador', color: 'text-red-500', bg: 'bg-red-500/10' };
    if (rol === 'PROFESOR') return { label: 'Examinador', color: 'text-blue-500', bg: 'bg-blue-500/10' };
    return { label: 'Capacitante', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
  };

  if (!open) return null;

  const rolInfo = getRolLabel(profileData?.rol || '');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Configuración de Perfil</h2>
              <p className="text-xs text-muted-foreground">Modifica tu información personal</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

            {/* Feedback */}
            {feedback && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold animate-in slide-in-from-top-2 duration-200 ${
                feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
              }`}>
                {feedback.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {feedback.msg}
              </div>
            )}

            {/* Role badge + date */}
            <div className="flex items-center gap-3">
              <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg ${rolInfo.bg} ${rolInfo.color}`}>
                <Shield className="h-3 w-3" /> {rolInfo.label}
              </span>
              <span className="text-xs text-muted-foreground">
                Registrado: {profileData?.created_at ? new Date(profileData.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
              </span>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Nombre</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Apellido</label>
                <input
                  type="text"
                  value={apellido}
                  onChange={e => setApellido(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                />
              </div>
            </div>

            {/* Password change section */}
            <div className="pt-2 border-t border-border/50">
              <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                <Lock className="h-4 w-4 text-muted-foreground" /> Cambiar Contraseña
                <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Contraseña Actual</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type={showCurrentPwd ? 'text' : 'password'}
                      value={contrasenaActual}
                      onChange={e => setContrasenaActual(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-background border border-border rounded-xl text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                    <button type="button" onClick={() => setShowCurrentPwd(!showCurrentPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Nueva Contraseña</label>
                    <div className="relative">
                      <input
                        type={showNewPwd ? 'text' : 'password'}
                        value={nuevaContrasena}
                        onChange={e => setNuevaContrasena(e.target.value)}
                        placeholder="Mín. 6 caracteres"
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Confirmar</label>
                    <div className="relative">
                      <input
                        type={showNewPwd ? 'text' : 'password'}
                        value={confirmarContrasena}
                        onChange={e => setConfirmarContrasena(e.target.value)}
                        placeholder="Repetir contraseña"
                        className={`w-full px-4 py-2.5 bg-background border rounded-xl text-sm font-medium focus:ring-1 outline-none transition-all ${
                          confirmarContrasena && confirmarContrasena !== nuevaContrasena ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-border focus:border-primary focus:ring-primary'
                        }`}
                      />
                      <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-border/50 bg-muted/5">
            <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-muted">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Cambios
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
