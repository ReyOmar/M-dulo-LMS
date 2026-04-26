"use client";

import { useEffect, useState } from "react";
import { BookOpen, Users, Award, TrendingUp, GraduationCap, AlertCircle, Loader2 } from "lucide-react";
import { PageLoader } from "@/components/PageLoader";
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import Recharts to avoid SSR issues
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });

export function AdminDashboard() {
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('http://localhost:3200/api/auth/solicitudes').then(r => r.json()).catch(() => []),
      fetch('http://localhost:3200/api/cursos/admin/dashboard-stats').then(r => r.json()).catch(() => null)
    ]).then(([solicitudes, dashStats]) => {
      const pending = Array.isArray(solicitudes) ? solicitudes.filter((s: any) => s.estado === 'PENDIENTE').length : 0;
      setSolicitudesPendientes(pending);
      setStats(dashStats);
      setLoading(false);
    });
  }, []);

  const weeklyActivity = stats?.weeklyActivity || [];
  const courseDistribution = stats?.courseDistribution || [];
  const totalMatriculas = stats?.totalMatriculas || 0;

  if (loading) {
    return <PageLoader message="Cargando panel administrativo..." />;
  }

  return (
    <div className="animate-in fade-in duration-700">
      <header className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Panel Administrativo</h1>
          <p className="text-muted-foreground mt-1">Visión de estado general de la plataforma y métricas maestras.</p>
        </div>
        <p className="text-xs text-muted-foreground font-medium">
          Última actualización: <span className="text-foreground font-semibold">{stats?.timestamp ? new Date(stats.timestamp).toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '...'}</span>
        </p>
      </header>

      {/* ═══════════════════ KPI CARDS ═══════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        
        {/* Usuarios Activos */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 p-5 shadow-sm hover:shadow-lg transition-all duration-300 group
                        bg-card/70 backdrop-blur-md hover:border-primary/40">
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 blur-xl group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Usuarios Activos</p>
              <p className="text-3xl font-black tracking-tight">{stats?.usuarios?.total || 0}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {stats?.usuarios?.estudiantes || 0} estudiantes · {stats?.usuarios?.profesores || 0} profesores
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 group-hover:scale-110 transition-transform">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        {/* Cursos */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 p-5 shadow-sm hover:shadow-lg transition-all duration-300 group
                        bg-card/70 backdrop-blur-md hover:border-blue-500/40">
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/5 blur-xl group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Cursos Publicados</p>
              <p className="text-3xl font-black tracking-tight">{stats?.cursos?.publicados || 0}</p>
              <p className="text-xs text-muted-foreground mt-2">{stats?.cursos?.borrador || 0} en modo borrador</p>
            </div>
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 group-hover:scale-110 transition-transform">
              <BookOpen className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Solicitudes Pendientes — conectado a API real */}
        <Link href="/dashboard/admin/solicitudes" className="relative overflow-hidden rounded-2xl border border-border/50 p-5 shadow-sm hover:shadow-lg transition-all duration-300 group
                        bg-card/70 backdrop-blur-md hover:border-orange-500/40 cursor-pointer">
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-500/5 blur-xl group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Solicitudes Pendientes</p>
              <p className="text-3xl font-black tracking-tight">{solicitudesPendientes}</p>
              <p className={`text-xs font-semibold mt-2 flex items-center gap-1 ${solicitudesPendientes > 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
                <AlertCircle className="h-3 w-3" /> {solicitudesPendientes > 0 ? 'Requieren revisión' : 'Todo al día'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/10 group-hover:scale-110 transition-transform">
              <Users className="h-5 w-5 text-orange-500" />
            </div>
          </div>
        </Link>

        {/* Promedio Calificación */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 p-5 shadow-sm hover:shadow-lg transition-all duration-300 group
                        bg-card/70 backdrop-blur-md hover:border-amber-500/40">
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-500/5 blur-xl group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Calificación Global</p>
              <p className="text-3xl font-black tracking-tight">
                {stats?.promedioGlobal || 0}<span className="text-lg text-muted-foreground">/5.0</span>
              </p>
              <p className="text-xs text-amber-500 font-semibold mt-2 flex items-center gap-1">
                <Award className="h-3 w-3" /> {stats?.promedioGlobal >= 4 ? 'Excelente rendimiento' : stats?.promedioGlobal >= 3 ? 'Buen rendimiento' : stats?.promedioGlobal > 0 ? 'Necesita mejora' : 'Sin calificaciones'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/10 group-hover:scale-110 transition-transform">
              <GraduationCap className="h-5 w-5 text-amber-500" />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════ CHARTS ROW ═══════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        
        {/* Weekly Activity Chart — spans 2 columns */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-border/50 p-6 shadow-sm
                        bg-card/70 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-700">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold">Actividad Semanal</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Recursos completados y entregas (últimos 7 días)</p>
              </div>
              <div className="flex gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Recursos
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Entregas
                </span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyActivity} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradSesiones" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradEntregas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(150, 65%, 45%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(150, 65%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                      fontSize: '13px',
                    }}
                  />
                  <Area type="monotone" dataKey="sesiones" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gradSesiones)" />
                  <Area type="monotone" dataKey="entregas" stroke="hsl(150, 65%, 45%)" strokeWidth={2} fill="url(#gradEntregas)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Student Distribution Donut */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 p-6 shadow-sm
                        bg-card/70 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-700">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/[0.03] to-transparent pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-lg font-bold mb-1">Distribución por Curso</h2>
            <p className="text-xs text-muted-foreground mb-4">{totalMatriculas} matrículas totales</p>
            {courseDistribution.length > 0 ? (
              <>
                <div className="h-52 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={courseDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {courseDistribution.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                          fontSize: '13px',
                        }}
                        formatter={(value: number, name: string) => [`${value} estudiantes`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="space-y-2 mt-4">
                  {courseDistribution.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs group/item hover:bg-muted/30 rounded-lg px-2 py-1 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                        <span className="font-medium text-foreground">{c.name}</span>
                      </div>
                      <span className="font-bold text-muted-foreground group-hover/item:text-foreground transition-colors">
                        {c.value} <span className="font-normal">({totalMatriculas > 0 ? Math.round(c.value / totalMatriculas * 100) : 0}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BookOpen className="h-10 w-10 opacity-30 mb-3" />
                <p className="text-sm">Sin cursos publicados aún</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
