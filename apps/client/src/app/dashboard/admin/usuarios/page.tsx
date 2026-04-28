"use client";

import { useEffect, useState } from "react";
import { Users, ShieldAlert, Key, UserCheck, UserX, Clock, Mail, BookOpen, X, GraduationCap, Shield, Presentation, Search } from "lucide-react";
import { PageLoader } from "@/components/ui/PageLoader";
import { useRole } from "@/contexts/RoleContext";
import Link from "next/link";
import api from "@/lib/api";

interface Usuario {
  guid: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: string;
  activo: boolean;
  contrasena?: string | null;
  created_at: string;
}

interface CursoAsignado {
  guid: string;
  titulo: string;
  estado: string;
  created_at: string;
  updated_at?: string;
  fecha_asignacion?: string;
}

type TabType = 'ADMINISTRADOR' | 'PROFESOR' | 'ESTUDIANTE';

export default function BaseUsuarios() {
  const { realRole } = useRole();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [userCourses, setUserCourses] = useState<CursoAsignado[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('PROFESOR');
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    try {
      const res = await api.get("/auth/usuarios");
      const data = res.data;
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openUserDetail = async (user: Usuario) => {
    setSelectedUser(user);
    setLoadingCursos(true);

    try {
      const res = await api.get(`/cursos/usuario-cursos?usuario_guid=${user.guid}&rol=${user.rol}`);
      const data = res.data;
      setUserCourses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setUserCourses([]);
    } finally {
      setLoadingCursos(false);
    }
  };

  const filteredUsuarios = usuarios.filter(u => {
    const matchesSearch = `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = u.rol === activeTab;
    return matchesSearch && matchesTab;
  });

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

  const getRoleInfo = (rol: string) => {
    if (rol === 'ADMINISTRADOR') return { name: 'Administrador', color: 'text-red-500', bg: 'bg-red-500/10' };
    if (rol === 'PROFESOR') return { name: 'Examinador', color: 'text-blue-500', bg: 'bg-blue-500/10' };
    return { name: 'Estudiante', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
  };

  return (
    <div className="animate-in fade-in duration-700">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          Base de Usuarios 
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold">{usuarios.length} Registrados</span>
        </h1>
        <p className="text-muted-foreground mt-2">Visión global de todas las cuentas organizadas por rol. Haz click en un examinador o estudiante para ver sus cursos.</p>
      </header>

      {/* Tabs y Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50">
          <button 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ADMINISTRADOR' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('ADMINISTRADOR')}
          >
            <Shield className="h-4 w-4 text-red-500" />
            Administradores ({usuarios.filter(u => u.rol === 'ADMINISTRADOR').length})
          </button>
          <button 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'PROFESOR' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('PROFESOR')}
          >
            <Presentation className="h-4 w-4 text-blue-500" />
            Examinadores ({usuarios.filter(u => u.rol === 'PROFESOR').length})
          </button>
          <button 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ESTUDIANTE' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('ESTUDIANTE')}
          >
            <GraduationCap className="h-4 w-4 text-emerald-500" />
            Estudiantes ({usuarios.filter(u => u.rol === 'ESTUDIANTE').length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o correo..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium"
          />
        </div>
      </div>

      {loading ? (
        <PageLoader message="Cargando base de usuarios..." />
      ) : (
        <div className="bg-card/70 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-6 duration-500">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/30 border-b border-border/50 uppercase text-xs font-bold text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Usuario</th>
                <th className="px-5 py-3">Contacto</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Fecha Ingreso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredUsuarios.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground font-medium">
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredUsuarios.map(user => {
                  const clickable = user.rol === 'PROFESOR' || user.rol === 'ESTUDIANTE';
                  const roleInfo = getRoleInfo(user.rol);
                  
                  return (
                    <tr 
                      key={user.guid} 
                      className={`hover:bg-muted/10 transition-colors ${clickable ? 'cursor-pointer hover:bg-primary/5' : ''}`}
                      onClick={() => clickable && openUserDetail(user)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${roleInfo.bg.replace('/10', '')} ${user.rol === 'ADMINISTRADOR' ? 'bg-red-500' : user.rol === 'PROFESOR' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                             {user.nombre.charAt(0)}{user.apellido.charAt(0)}
                          </div>
                          <div className="font-bold text-sm">{user.nombre} {user.apellido}</div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Mail className="h-3 w-3 shrink-0" /> {user.email}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                         <div className="flex items-center gap-3">
                            {user.activo ? (
                                <span className="flex items-center gap-1 text-emerald-500 text-xs font-bold"><UserCheck className="h-3 w-3" /> Activo</span>
                            ) : (
                                <span className="flex items-center gap-1 text-red-500 text-xs font-bold"><UserX className="h-3 w-3" /> Inactivo</span>
                            )}
                            {!user.contrasena && (
                                <span className="flex items-center gap-1 text-amber-500 text-xs font-bold" title="No ha configurado su contraseña"><Key className="h-3 w-3" /> Sin Clave</span>
                            )}
                         </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-sm">
                          <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {new Date(user.created_at).toLocaleDateString()}
                          </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ======= USER DETAIL MODAL ======= */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-24 animate-in fade-in duration-300" onClick={() => setSelectedUser(null)}>
          <div 
            className="bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-lg p-8 animate-in slide-in-from-bottom-4 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${selectedUser.rol === 'PROFESOR' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                  {selectedUser.nombre.charAt(0)}{selectedUser.apellido.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selectedUser.nombre} {selectedUser.apellido}</h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {selectedUser.email}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-muted rounded-xl transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-muted/20 rounded-xl p-4">
                <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Rol</p>
                <p className={`text-sm font-bold ${getRoleInfo(selectedUser.rol).color}`}>{getRoleInfo(selectedUser.rol).name}</p>
              </div>
              <div className="bg-muted/20 rounded-xl p-4">
                <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Estado</p>
                <p className="text-sm font-bold">{selectedUser.activo ? '✓ Activo' : '✕ Inactivo'}</p>
              </div>
              <div className="bg-muted/20 rounded-xl p-4">
                <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Ingreso</p>
                <p className="text-sm font-bold">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
              </div>
              <div className="bg-muted/20 rounded-xl p-4">
                <p className="text-xs text-muted-foreground font-bold uppercase mb-1">{selectedUser.rol === 'PROFESOR' ? 'Cursos Asignados' : 'Cursos Matriculados'}</p>
                <p className="text-sm font-bold">{loadingCursos ? '...' : userCourses.length}</p>
              </div>
            </div>

            {/* Assigned/Enrolled Courses */}
            <div>
              <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-wider mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> {selectedUser.rol === 'PROFESOR' ? 'Cursos Asignados' : 'Cursos Matriculados'}
              </h3>
              {loadingCursos ? (
                <div className="text-center py-6 text-muted-foreground text-sm flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4 animate-spin"/> Cargando cursos...
                </div>
              ) : userCourses.length === 0 ? (
                <div className="text-center py-6 bg-muted/10 rounded-xl border border-border/50">
                  <p className="text-sm text-muted-foreground">Este usuario no tiene cursos {selectedUser.rol === 'PROFESOR' ? 'asignados' : 'matriculados'}.</p>
                  {selectedUser.rol === 'PROFESOR' && (
                    <Link href="/dashboard/constructor-cursos" className="text-xs text-primary font-bold hover:underline mt-2 inline-block">
                      Ir a Gestión de Cursos para asignar →
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {userCourses.map(curso => (
                    <div key={curso.guid} className="flex items-center justify-between p-3 bg-muted/10 rounded-xl border border-border/30 hover:border-primary/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{curso.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedUser?.rol === 'PROFESOR' ? 'Asignado' : 'Matriculado'}: {(() => {
                              const d = curso.fecha_asignacion || curso.updated_at || curso.created_at;
                              return d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Sin fecha';
                            })()}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                        curso.estado === 'PUBLICADO' ? 'bg-emerald-500/10 text-emerald-500' :
                        curso.estado === 'BORRADOR' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {curso.estado}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
