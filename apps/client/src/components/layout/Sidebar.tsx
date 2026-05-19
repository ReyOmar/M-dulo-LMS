'use client';

import { useRole, Role } from '@/contexts/RoleContext';
import { useConfig, resolveFileUrl } from '@/contexts/ConfigContext';
import {
  GraduationCap,
  BookOpen,
  Clock,
  Award,
  Shield,
  Settings,
  Users,
  ArrowRight,
  Compass,
  ShieldAlert,
  BarChart3,
  Presentation,
  BookCheck,
  ClipboardList,
  LogOut,
  CheckCircle,
  Palette,
  ChevronUp,
  ClipboardCheck,
  MessageSquare,
  FileSignature,
  Globe,
  Mail,
  Menu,
  X,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { UserSettingsModal } from '@/components/features/UserSettingsModal';
import { useState, useRef, useEffect } from 'react';
import api, { API_BASE_URL, resolveFileUrl as resolveFile } from '@/lib/api';
import { useWS } from '@/contexts/WebSocketContext';
import { NotificationCenter } from '@/components/features/NotificationCenter';

export function Sidebar() {
  const { role, user, logout } = useRole();
  const { config } = useConfig();
  const pathname = usePathname() || '';

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [solicitudesCount, setSolicitudesCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

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
    if (role !== 'admin') return;

    const fetchCount = async () => {
      try {
        const res = await api.get('/auth/solicitudes');
        setSolicitudesCount(Array.isArray(res.data) ? res.data.length : 0);
      } catch (err) {
        console.error('Error fetching solicitudes count:', err);
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
  }, [role, subscribe]);

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
        setUnreadMessagesCount((prev) => prev + 1);
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

  // Auto-close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(path);
  };

  const linkClass = (path: string) => {
    return `sidebar-link ${isActive(path) ? 'sidebar-link-active' : ''}`;
  };

  const userName =
    user?.nombre || (role === 'student' ? 'Personal' : role === 'teacher' ? 'Examinador' : 'Administrador');
  const userLastName = user?.apellido || '';
  const initials = `${userName.charAt(0)}${userLastName.charAt(0) || ''}`.toUpperCase();

  return (
    <>
      {/* ── Mobile Hamburger Button ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-[110] p-2.5 rounded-xl bg-card border border-border/50 shadow-md text-foreground hover:bg-muted transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* ── Mobile Overlay ── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        ref={sidebarRef}
        className={`sidebar-nav w-80 border-r flex flex-col fixed h-full z-[130] transition-transform duration-300 ease-out
          lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* ── Header ── */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border/30 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 font-bold text-base text-primary overflow-hidden flex-1">
            {config?.logo_url ? (
              <img
                src={resolveFileUrl(config.logo_url) || ''}
                alt="Logo"
                className="max-h-10 max-w-[36px] object-contain shrink-0"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <GraduationCap className="h-4.5 w-4.5 text-primary" />
              </div>
            )}
            <span className={`truncate font-semibold text-foreground ${config?.logo_url ? 'hidden sm:inline' : ''}`}>
              {config?.nombre_plataforma || 'PESV Education'}
            </span>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            <NotificationCenter />
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Navigation ── */}
        <div className="py-5 px-3 flex-1 overflow-y-auto">
          {/* --- EXAMINADOR BLOCK --- */}
          {role === 'teacher' && (
            <>
              <div className="space-y-0.5 mb-7">
                <p className="sidebar-section-label">Gestión de Evaluaciones</p>
                <Link
                  prefetch={true}
                  href="/dashboard"
                  className={linkClass('/dashboard')}
                  onClick={() => setMobileOpen(false)}
                >
                  <Presentation className="h-4 w-4 shrink-0" /> Asignaciones
                </Link>
                <Link
                  prefetch={true}
                  href="/dashboard/examiner/monitoreo"
                  className={linkClass('/dashboard/examiner/monitoreo')}
                  onClick={() => setMobileOpen(false)}
                >
                  <Users className="h-4 w-4 shrink-0" /> Monitoreo de Estudiantes
                </Link>
                <Link
                  prefetch={true}
                  href="/dashboard/examiner/pruebas"
                  className={linkClass('/dashboard/examiner/pruebas')}
                  onClick={() => setMobileOpen(false)}
                >
                  <ClipboardCheck className="h-4 w-4 shrink-0" /> Monitoreo de Pruebas
                </Link>
                <Link
                  prefetch={true}
                  href="/dashboard/examiner/calificaciones"
                  className={linkClass('/dashboard/examiner/calificaciones')}
                  onClick={() => setMobileOpen(false)}
                >
                  <BookCheck className="h-4 w-4 shrink-0" /> Calificación Manual
                </Link>
                <Link
                  prefetch={true}
                  href="/dashboard/examiner/firma"
                  className={linkClass('/dashboard/examiner/firma')}
                  onClick={() => setMobileOpen(false)}
                >
                  <FileSignature className="h-4 w-4 shrink-0" /> Mi Firma
                </Link>
                <Link
                  prefetch={true}
                  href="/dashboard/mensajes"
                  className={linkClass('/dashboard/mensajes')}
                  onClick={() => setMobileOpen(false)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span>Mensajes</span>
                  {unreadMessagesCount > 0 && !pathname.startsWith('/dashboard/mensajes') && (
                    <span className="ml-auto bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                    </span>
                  )}
                </Link>
              </div>
            </>
          )}

          {/* --- PERSONAL EN CAPACITACIÓN BLOCK --- */}
          {role === 'student' && (
            <div className="space-y-0.5 mb-7">
              <p className="sidebar-section-label">Área de Aprendizaje</p>
              <Link
                prefetch={true}
                href="/dashboard"
                className={linkClass('/dashboard')}
                onClick={() => setMobileOpen(false)}
              >
                <Compass className="h-4 w-4 shrink-0" /> Mi Tablero
              </Link>
              <Link
                prefetch={true}
                href="/dashboard/student/cursos"
                className={linkClass('/dashboard/student/cursos')}
                onClick={() => setMobileOpen(false)}
              >
                <BookOpen className="h-4 w-4 shrink-0" /> Mis Cursos Activos
              </Link>
              <Link
                prefetch={true}
                href="/dashboard/student/certificados"
                className={linkClass('/dashboard/student/certificados')}
                onClick={() => setMobileOpen(false)}
              >
                <Award className="h-4 w-4 shrink-0" /> Mis Certificados PDF
              </Link>
              <Link
                prefetch={true}
                href="/dashboard/mensajes"
                className={linkClass('/dashboard/mensajes')}
                onClick={() => setMobileOpen(false)}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span>Mensajes</span>
                {unreadMessagesCount > 0 && !pathname.startsWith('/dashboard/mensajes') && (
                  <span className="ml-auto bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                  </span>
                )}
              </Link>
            </div>
          )}

          {/* --- ADMIN ONLY BLOCK --- */}
          {role === 'admin' && (
            <>
              <div className="space-y-0.5 mb-6">
                <p className="sidebar-section-label">Visión Global</p>
                <Link
                  prefetch={true}
                  href="/dashboard"
                  className={linkClass('/dashboard')}
                  onClick={() => setMobileOpen(false)}
                >
                  <BarChart3 className="h-4 w-4 shrink-0" /> Panel Administrativo
                </Link>
              </div>

              <div className="space-y-0.5 mb-6">
                <p className="sidebar-section-label">Construcción</p>
                <Link
                  prefetch={true}
                  href="/dashboard/constructor-cursos"
                  className={linkClass('/dashboard/constructor-cursos')}
                  onClick={() => setMobileOpen(false)}
                >
                  <BookOpen className="h-4 w-4 shrink-0" /> Gestión de Cursos
                </Link>
                <Link
                  prefetch={true}
                  href="/dashboard/admin/asignacion-cursos"
                  className={linkClass('/dashboard/admin/asignacion-cursos')}
                  onClick={() => setMobileOpen(false)}
                >
                  <ClipboardList className="h-4 w-4 shrink-0" /> Asignación de Cursos
                </Link>
              </div>

              <div className="space-y-0.5 mb-6">
                <p className="sidebar-section-label">Administración del Sistema</p>
                <Link
                  prefetch={true}
                  href="/dashboard/admin/usuarios"
                  className={linkClass('/dashboard/admin/usuarios')}
                  onClick={() => setMobileOpen(false)}
                >
                  <Users className="h-4 w-4 shrink-0" /> Base de Usuarios
                </Link>
                <Link
                  prefetch={true}
                  href="/dashboard/admin/solicitudes"
                  className={linkClass('/dashboard/admin/solicitudes')}
                  onClick={() => setMobileOpen(false)}
                >
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Solicitudes y Registro</span>
                  {solicitudesCount > 0 && (
                    <span className="ml-auto bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                      {solicitudesCount}
                    </span>
                  )}
                </Link>
                <Link
                  prefetch={true}
                  href="/dashboard/admin/certificados-config"
                  className={linkClass('/dashboard/admin/certificados-config')}
                  onClick={() => setMobileOpen(false)}
                >
                  <FileSignature className="h-4 w-4 shrink-0" /> Certificados
                </Link>
                <Link
                  prefetch={true}
                  href="/dashboard/admin/tema"
                  className={linkClass('/dashboard/admin/tema')}
                  onClick={() => setMobileOpen(false)}
                >
                  <Palette className="h-4 w-4 shrink-0" /> Tema y Apariencia
                </Link>
                <Link
                  prefetch={true}
                  href="/dashboard/admin/landing-config"
                  className={linkClass('/dashboard/admin/landing-config')}
                  onClick={() => setMobileOpen(false)}
                >
                  <Globe className="h-4 w-4 shrink-0" /> Landing Page
                </Link>
                <Link
                  prefetch={true}
                  href="/dashboard/admin/correos"
                  className={linkClass('/dashboard/admin/correos')}
                  onClick={() => setMobileOpen(false)}
                >
                  <Mail className="h-4 w-4 shrink-0" /> Correos y Eventos
                </Link>
              </div>
            </>
          )}
        </div>

        {/* ── User Footer ── */}
        <div className="p-3 border-t border-border/30 shrink-0 relative" ref={menuRef}>
          {/* Popup Menu */}
          {showUserMenu && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden animate-scale-in z-20">
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  setMobileOpen(false);
                  setShowSettings(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                <Settings className="h-4 w-4 text-muted-foreground" /> Configuración
              </button>
              <div className="border-t border-border/50" />
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
              >
                <LogOut className="h-4 w-4" /> Cerrar Sesión
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 overflow-hidden flex-1 rounded-xl px-2 py-2 hover:bg-muted/50 transition-colors group"
            >
              <div className="h-9 w-9 shrink-0 rounded-xl overflow-hidden shadow-sm">
                {user?.foto_url ? (
                  <img
                    src={resolveFile(user.foto_url) || ''}
                    alt={`${userName} ${userLastName}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = 'none';
                      const fallback = img.nextElementSibling;
                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className="h-full w-full bg-primary text-primary-foreground items-center justify-center font-bold text-sm"
                  style={{ display: user?.foto_url ? 'none' : 'flex' }}
                >
                  {initials}
                </div>
              </div>
              <div className="truncate flex-1 text-left">
                <p className="text-sm font-semibold leading-none">
                  {userName} {userLastName}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 truncate">
                  {role === 'student' ? 'En Capacitación' : role === 'teacher' ? 'Examinador' : 'Administrador'}
                </p>
              </div>
              <ChevronUp
                className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${showUserMenu ? '' : 'rotate-180'}`}
              />
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
