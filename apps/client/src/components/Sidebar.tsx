"use client";

import { useRole, Role } from "@/contexts/RoleContext";
import { useConfig } from "@/contexts/ConfigContext";
import { GraduationCap, BookOpen, Clock, Award, Shield, Settings, Users, ArrowRight, Compass, ShieldAlert, BarChart3, Presentation, BookCheck, ClipboardList, LogOut, CheckCircle, Palette } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function Sidebar() {
  const { role, realRole, simulatedRole, setSimulatedRole, logout } = useRole();
  const { config } = useConfig();
  const pathname = usePathname() || "";

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(path);
  };

  const linkClass = (path: string) => {
    return isActive(path) 
      ? "flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-2 text-primary font-medium transition-colors"
      : "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted font-medium transition-colors";
  };

  return (
    <aside className="w-80 border-r border-border bg-card flex flex-col fixed h-full z-10 transition-all">
      <div className="h-20 flex items-center px-6 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2 font-bold text-lg text-primary">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span>{config?.nombre_plataforma || 'PESV Education'} {simulatedRole && "(Simulado)"}</span>
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
                <Link href="/dashboard/examiner/calificaciones" className={linkClass('/dashboard/examiner/calificaciones')}>
                    <BookCheck className="h-4 w-4" /> Calificación Manual
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
                <Link href="/dashboard" className={linkClass('/dashboard')}>
                    <ClipboardList className="h-4 w-4" /> Subida de Archivos
                </Link>
                <Link href="/dashboard" className={linkClass('/dashboard')}>
                    <Award className="h-4 w-4" /> Mis Certificados PDF
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
                    <Link href="/dashboard/constructor-cursos" className={linkClass('/dashboard/constructor-cursos')}>
                        <BookOpen className="h-4 w-4" /> Gestión de Cursos
                    </Link>
                </div>

                <div className="space-y-1 mb-6 animate-in slide-in-from-left-2">
                    <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Administración del Sistema</p>
                    <Link href="/dashboard/admin/usuarios" className={linkClass('/dashboard/admin/usuarios')}>
                        <Users className="h-4 w-4" /> Base de Usuarios
                    </Link>
                    <Link href="/dashboard/admin/solicitudes" className={linkClass('/dashboard/admin/solicitudes')}>
                        <Users className="h-4 w-4" /> Solicitudes Pendientes
                    </Link>
                    <Link href="/dashboard/admin/tema" className={linkClass('/dashboard/admin/tema')}>
                        <Palette className="h-4 w-4" /> Tema y Apariencia
                    </Link>
                </div>
            </>
        )}
      </div>
      
      <div className="p-4 border-t border-border/40 shrink-0 bg-muted/10">
          <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3 overflow-hidden flex-1">
                <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold shadow-sm ring-2 ring-background
                    ${role === "admin" ? "bg-red-500" : (role === "teacher" ? "bg-blue-500" : "bg-emerald-500")}
                `}>
                  {role.charAt(0).toUpperCase()}
                </div>
                <div className="truncate flex-1">
                  <p className="text-sm font-bold leading-none capitalize">
                    {role === "student" ? "Personal" : role === "teacher" ? "Examinador" : "Administrador"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {simulatedRole ? "Simulación Activa" : (role === "student" ? "En Capacitación" : role === "teacher" ? "Asignaciones" : "Control Total")}
                  </p>
                </div>
              </div>
              <ThemeToggle />
          </div>
          
          <div className="flex items-center justify-end mt-2 pt-2 border-t border-border/50">
             <button onClick={logout} className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors">
                 <LogOut className="h-4 w-4" /> Salir
             </button>
          </div>
      </div>
    </aside>
  );
}
