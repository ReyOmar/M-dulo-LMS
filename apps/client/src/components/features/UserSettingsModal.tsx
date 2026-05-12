'use client';

import { useEffect, useState, useRef } from 'react';
import {
  X,
  User,
  Mail,
  Lock,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Shield,
  Eye,
  EyeOff,
  Camera,
  Trash2,
} from 'lucide-react';
import { useRole } from '@/contexts/RoleContext';
import api, { API_BASE_URL, resolveFileUrl } from '@/lib/api';

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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    onClose();
  };

  useEffect(() => {
    if (open) {
      if (user?.guid) {
        fetchProfile();
      }
    } else {
      // Clear data when modal closes to prevent residual info
      setNombre('');
      setApellido('');
      setEmail('');
      setContrasenaActual('');
      setNuevaContrasena('');
      setConfirmarContrasena('');
      setShowCurrentPwd(false);
      setShowNewPwd(false);
      setFeedback(null);
      setProfileData(null);
    }
  }, [open, user?.guid]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/auth/perfil/${user.guid}`);
      const data = res.data;
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

      const res = await api.patch(`/auth/perfil/${user.guid}`, body);

      const data = res.data;

      // Sync session with updated data
      if (data.user) {
        const token = localStorage.getItem('lms_token') || '';
        syncSession(token, { ...user, nombre: data.user.nombre, apellido: data.user.apellido });
      }

      showFeedback('success', 'Perfil actualizado exitosamente.');
      setContrasenaActual('');
      setNuevaContrasena('');
      setConfirmarContrasena('');

      // Auto-close after success
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error de conexión.';
      showFeedback('error', msg);
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      showFeedback('error', 'Solo se permiten imágenes (JPG, PNG, WebP, GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showFeedback('error', 'La imagen no puede superar los 5 MB.');
      return;
    }
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('foto', file);
      const res = await api.post(`/auth/perfil/${user.guid}/foto`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newFotoUrl = res.data.foto_url;
      setProfileData((prev: any) => ({ ...prev, foto_url: newFotoUrl }));
      // Sync session so sidebar updates immediately
      const token = localStorage.getItem('lms_token') || '';
      syncSession(token, { ...user, foto_url: newFotoUrl });
      showFeedback('success', 'Foto de perfil actualizada.');
    } catch (err: any) {
      showFeedback('error', err.response?.data?.message || 'Error al subir la foto.');
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handlePhotoDelete = async () => {
    setDeletingPhoto(true);
    try {
      await api.delete(`/auth/perfil/${user.guid}/foto`);
      setProfileData((prev: any) => ({ ...prev, foto_url: null }));
      const token = localStorage.getItem('lms_token') || '';
      syncSession(token, { ...user, foto_url: null });
      showFeedback('success', 'Foto de perfil eliminada.');
    } catch (err: any) {
      showFeedback('error', err.response?.data?.message || 'Error al eliminar la foto.');
    } finally {
      setDeletingPhoto(false);
    }
  };

  if (!open) return null;

  const rolInfo = getRolLabel(profileData?.rol || '');

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
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
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-xl transition-colors active:scale-90 duration-200"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[70dvh] overflow-y-auto">
            {/* Feedback */}
            {feedback && (
              <div
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold animate-in slide-in-from-top-2 duration-200 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-500 border border-red-500/20'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {feedback.msg}
              </div>
            )}

            {/* Role badge + date */}
            <div className="flex items-center gap-3">
              <span
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg ${rolInfo.bg} ${rolInfo.color}`}
              >
                <Shield className="h-3 w-3" /> {rolInfo.label}
              </span>
              <span className="text-xs text-muted-foreground">
                Registrado:{' '}
                {profileData?.created_at
                  ? new Date(profileData.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : '—'}
              </span>
            </div>

            {/* Profile photo */}
            <div className="flex items-center gap-4">
              <div className="relative group">
                {profileData?.foto_url ? (
                  <img
                    src={resolveFileUrl(profileData.foto_url) || ''}
                    alt="Foto de perfil"
                    className="h-16 w-16 rounded-2xl object-cover border-2 border-border shadow-sm"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                    {(nombre.charAt(0) + (apellido.charAt(0) || '')).toUpperCase() || '?'}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-1 -right-1 p-1.5 bg-primary text-primary-foreground rounded-lg shadow-md hover:bg-primary/90 transition-all active:scale-90 disabled:opacity-50"
                >
                  {uploadingPhoto ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">
                  {nombre} {apellido}
                </p>
                <p className="text-xs text-muted-foreground">{email}</p>
                {profileData?.foto_url && (
                  <button
                    type="button"
                    onClick={handlePhotoDelete}
                    disabled={deletingPhoto}
                    className="mt-1 text-xs text-destructive hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    {deletingPhoto ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Eliminar foto
                  </button>
                )}
              </div>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Nombre
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Apellido
                </label>
                <input
                  type="text"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                />
              </div>
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm font-medium text-muted-foreground cursor-not-allowed outline-none"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 ml-1">
                El correo electrónico no se puede modificar.
              </p>
            </div>

            {/* Password change section */}
            <div className="pt-2 border-t border-border/50">
              <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                <Lock className="h-4 w-4 text-muted-foreground" /> Cambiar Contraseña
                <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Contraseña Actual
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type={showCurrentPwd ? 'text' : 'password'}
                      value={contrasenaActual}
                      onChange={(e) => setContrasenaActual(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-background border border-border rounded-xl text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 active:scale-90"
                      title={showCurrentPwd ? 'Ver' : 'Ocultar'}
                    >
                      <div className="relative h-4 w-4 flex items-center justify-center">
                        {showCurrentPwd ? (
                          <Eye className="h-4 w-4 animate-in zoom-in-75 duration-300" />
                        ) : (
                          <EyeOff className="h-4 w-4 animate-in zoom-in-75 duration-300" />
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Nueva Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPwd ? 'text' : 'password'}
                        value={nuevaContrasena}
                        onChange={(e) => setNuevaContrasena(e.target.value)}
                        placeholder="Mín. 6 caracteres"
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Confirmar
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPwd ? 'text' : 'password'}
                        value={confirmarContrasena}
                        onChange={(e) => setConfirmarContrasena(e.target.value)}
                        placeholder="Repetir contraseña"
                        className={`w-full px-4 py-2.5 bg-background border rounded-xl text-sm font-medium focus:ring-1 outline-none transition-all ${
                          confirmarContrasena && confirmarContrasena !== nuevaContrasena
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                            : 'border-border focus:border-primary focus:ring-primary'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPwd(!showNewPwd)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 active:scale-90"
                        title={showNewPwd ? 'Ver' : 'Ocultar'}
                      >
                        <div className="relative h-4 w-4 flex items-center justify-center">
                          {showNewPwd ? (
                            <Eye className="h-4 w-4 animate-in zoom-in-75 duration-300" />
                          ) : (
                            <EyeOff className="h-4 w-4 animate-in zoom-in-75 duration-300" />
                          )}
                        </div>
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
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 p-6 border-t border-border/50 bg-muted/5">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-muted active:scale-95"
            >
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
