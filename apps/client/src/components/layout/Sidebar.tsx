"use client";

import { useRole, Role } from "@/contexts/RoleContext";
import { useConfig } from "@/contexts/ConfigContext";
import { GraduationCap, BookOpen, Clock, Award, Shield, Settings, Users, ArrowRight, Compass, ShieldAlert, BarChart3, Presentation, BookCheck, ClipboardList, LogOut, CheckCircle, Palette, ChevronUp, ClipboardCheck, MessageSquare, FileSignature, Globe, Mail } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UserSettingsModal } from "@/components/features/UserSettingsModal";
import { useState, useRef, useEffect } from "react";
import api from "@/lib/api";
import { useWS } from "@/contexts/WebSocketContext";
import { NotificationCenter } from "@/components/features/NotificationCenter";

export function Sidebar() {
  const { role, realRole, simulatedRole, setSimulatedRole, user, logout } = useRole();
  const { config } = useConfig();
  const pathname = usePathname() || "";

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [solicitudesCount, setSolicitudesCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUserMenu]);

  const { subscribe } = useWS();

  // Real-time solicitudes count for admin
  useEffect(() => {
    if (realRole !== "admin") return;

    const fetchCount = async () => {
      try {
        const res = await api.get("/auth/solicitudes");
        setSolicitudesCount(Array.isArray(res.data) ? res.data.length : 0);
      } catch (err) {
        console.error("Error fetching solicitudes count:", err);
      }
    };

    fetchCount();
    
    const unsub1 = subscribe('request:new', fetchCount);
    const unsub2 = subscribe('dashboard:refresh', fetchCount);
    const unsub3 = subscribe('user:created', fetchCount);
    
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [realRole, subscribe]);

  // Real-time unread messages count
  useEffect(() => {
    const fetchUnreadMessages = async () => {
      try {
        const res = await api.get('/notificaciones/chat/contactos');
        const contacts = res.data || [];
        const total = contacts.reduce((sum: number, c: any) => sum + (c.no_leidos || 0), 0);
        setUnreadMessagesCount(total);
      } catch {}
    };

    fetchUnreadMessages();

    const unsubMsg = subscribe('message:new', () => {
      // Only increment if not currently on the messages page
      if (!pathname.startsWith('/dashboard/mensajes')) {
        setUnreadMessagesCount(prev => prev + 1);
      }
    });
    const unsubRefresh = subscribe('dashboard:refresh', fetchUnreadMessages);

    return () => {
      unsubMsg();
      unsubRefresh();
    };
  }, [subscribe, pathname]);

  // Reset unread count when navigating to messages page
  useEffect(() => {
    if (pathname.startsWith('/dashboard/mensajes')) {
      setUnreadMessagesCount(0);
    }
  }, [pathname]);

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(path);
  };

  const linkClass = (path: string) => {
    return isActive(path) 
      ? "flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-2 text-primary font-medium transition-colors"
      : "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted font-medium transition-colors";
  };

  const userName = user?.nombre || (role === "student" ? "Personal" : role === "teacher" ? "Examinador" : "Administrador");
  const userLastName = user?.apellido || '';
  const initials = `${userName.charAt(0)}${userLastName.charAt(0) || ''}`.toUpperCase();

  return (
    <>
      <aside className="w-80 border-r border-border bg-card flex flex-col fixed h-full z-[100] transition-all">
        <div className="h-20 flex items-center justify-between px-6 border-b border-border/40 shrink-0 gap-2">
          <div className="flex items-center gap-2 font-bold text-lg text-primary overflow-hidden flex-1">
            {config?.logo_url ? (
               <img src={config.logo_url} alt="Logo" className="max-h-12 max-w-[40px] object-contain shrink-0" />
            ) : (
               <GraduationCap className="h-6 w-6 text-primary shrink-0" />
            )}
            <span className={config?.logo_url ? "hidden sm:inline truncate" : "truncate"}>{config?.nombre_plataforma || 'PESV Education'} {simulatedRole && "(Simulado)"}</span>
          </div>
          <div className="shrink-0 flex items-center">
            <NotificationCenter />
          </div>
        </div>
        
        <div className="py-6 px-4 flex-1 overflow-y-auto">
          {/* --- EXAMINADOR BLOCK --- */}
          {role === "teacher" && (
              <div className="space-y-1 mb-8 animate-in slide-in-from-left-2">
                  <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Gestión de Evaluaciones</p>
                  <Link href="/dashboard" className={linkClass('/dashboard')}>
                      <Presentation className="h-4 w-4" /> Asignaciones
                  </Link>
                  <Link href="/dashboard/examiner/monitoreo" className={linkClass('/dashboard/examiner/monitoreo')}>
                      <Users className="h-4 w-4" /> Monitoreo de Estudiantes
                  </Link>
                  <Link href="/dashboard/examiner/pruebas" className={linkClass('/dashboard/examiner/pruebas')}>
                      <ClipboardCheck className="h-4 w-4" /> Monitoreo de Pruebas
                  </Link>
                  <Link href="/dashboard/examiner/calificaciones" className={linkClass('/dashboard/examiner/calificaciones')}>
                      <BookCheck className="h-4 w-4" /> Calificación Manual
                  </Link>
                  <Link href="/dashboard/examiner/firma" className={linkClass('/dashboard/examiner/firma')}>
                      <FileSignature className="h-4 w-4" /> Mi Firma
                  </Link>
                  <Link href="/dashboard/mensajes" className={linkClass('/dashboard/mensajes')}>
                      <MessageSquare className="h-4 w-4" />
                      <span>Mensajes</span>
                      {unreadMessagesCount > 0 && !pathname.startsWith('/dashboard/mensajes') && (
                        <span className="ml-auto bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_hsl(var(--primary)/0.5)]">
                          {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                        </span>
                      )}
                  </Link>
              </div>
          )}

          {/* --- PERSONAL EN CAPACITACIÓN BLOCK --- */}
          {role === "student" && (
              <div className="space-y-1 mb-8 animate-in slide-in-from-left-2">
                  <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Área de Aprendizaje</p>
                  <Link href="/dashboard" className={linkClass('/dashboard')}>
                      <Compass className="h-4 w-4" /> Mi Tablero
                  </Link>
                  <Link href="/dashboard/student/cursos" className={linkClass('/dashboard/student/cursos')}>
                      <BookOpen className="h-4 w-4" /> Mis Cursos Activos
                  </Link>
                  <Link href="/dashboard/student/certificados" className={linkClass('/dashboard/student/certificados')}>
                      <Award className="h-4 w-4" /> Mis Certificados PDF
                  </Link>
                  <Link href="/dashboard/mensajes" className={linkClass('/dashboard/mensajes')}>
                      <MessageSquare className="h-4 w-4" />
                      <span>Mensajes</span>
                      {unreadMessagesCount > 0 && !pathname.startsWith('/dashboard/mensajes') && (
                        <span className="ml-auto bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_hsl(var(--primary)/0.5)]">
                          {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                        </span>
                      )}
                  </Link>
              </div>
          )}

          {/* --- ADMIN ONLY BLOCK --- */}
          {role === "admin" && (
              <>
                  <div className="space-y-1 mb-6">
                      <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Visión Global</p>
                      <Link href="/dashboard" className={linkClass('/dashboard')}>
                          <BarChart3 className="h-4 w-4" /> Panel Administrativo
                      </Link>
                  </div>

                  <div className="space-y-1 mb-6 animate-in slide-in-from-left-2">
                      <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Construcción</p>
                      <Link href="/dashboard/admin/constructor-cursos" className={linkClass('/dashboard/admin/constructor-cursos')}>
                          <BookOpen className="h-4 w-4" /> Gestión de Cursos
                      </Link>
                      <Link href="/dashboard/admin/asignacion-cursos" className={linkClass('/dashboard/admin/asignacion-cursos')}>
                          <ClipboardList className="h-4 w-4" /> Asignación de Cursos
                      </Link>
                  </div>

                  <div className="space-y-1 mb-6 animate-in slide-in-from-left-2">
                      <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Administración del Sistema</p>
                      <Link href="/dashboard/admin/usuarios" className={linkClass('/dashboard/admin/usuarios')}>
                          <Users className="h-4 w-4" /> Base de Usuarios
                      </Link>
                      <Link href="/dashboard/admin/solicitudes" className={linkClass('/dashboard/admin/solicitudes')}>
                          <Users className="h-4 w-4" /> 
                          <span>Solicitudes Pendientes</span>
                          {solicitudesCount > 0 && (
                            <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                              {solicitudesCount}
                            </span>
                          )}
                      </Link>
                      <Link href="/dashboard/admin/certificados-config" className={linkClass('/dashboard/admin/certificados-config')}>
                          <FileSignature className="h-4 w-4" /> Certificados
                      </Link>
                      <Link href="/dashboard/admin/tema" className={linkClass('/dashboard/admin/tema')}>
                          <Palette className="h-4 w-4" /> Tema y Apariencia
                      </Link>
                      <Link href="/dashboard/admin/landing-config" className={linkClass('/dashboard/admin/landing-config')}>
                          <Globe className="h-4 w-4" /> Landing Page
                      </Link>
                      <Link href="/dashboard/admin/correos" className={linkClass('/dashboard/admin/correos')}>
                          <Mail className="h-4 w-4" /> Correos y Eventos
                      </Link>
                  </div>
              </>
          )}
        </div>
        
        {/* User Footer */}
        <div className="p-4 border-t border-border/40 shrink-0 bg-muted/10 relative" ref={menuRef}>
            {/* Popup Menu */}
            {showUserMenu && (
              <div className="absolute bottom-full left-4 right-4 mb-2 bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200 z-20">
                <button
                  onClick={() => { setShowUserMenu(false); setShowSettings(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" /> Configuración
                </button>
                <div className="border-t border-border/50" />
                <button
                  onClick={() => { setShowUserMenu(false); logout(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-500/5 transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Cerrar Sesión
                </button>
              </div>
            )}

            <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 overflow-hidden flex-1 rounded-lg px-1 py-1 hover:bg-muted/50 transition-colors group"
                >
                  <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold shadow-sm ring-2 ring-background
                      ${role === "admin" ? "bg-red-500" : (role === "teacher" ? "bg-blue-500" : "bg-emerald-500")}
                  `}>
                    {initials}
                  </div>
                  <div className="truncate flex-1 text-left">
                    <p className="text-sm font-bold leading-none">
                      {userName} {userLastName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {simulatedRole ? "Simulación Activa" : (role === "student" ? "En Capacitación" : role === "teacher" ? "Examinador" : "Administrador")}
                    </p>
                  </div>
                  <ChevronUp className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${showUserMenu ? '' : 'rotate-180'}`} />
                </button>
                <ThemeToggle />
            </div>
        </div>
      </aside>

      {/* Settings Modal */}
      <UserSettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
