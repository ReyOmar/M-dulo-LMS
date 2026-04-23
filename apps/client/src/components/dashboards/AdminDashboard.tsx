"use client";

import { useEffect, useState } from "react";
import { BookOpen, Clock, Users, Award, TrendingUp, BarChart3, Target, GraduationCap, AlertCircle } from "lucide-react";
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

// Mock data — replace with real API calls
const weeklyActivity = [
  { day: 'Lun', sesiones: 120, entregas: 34 },
  { day: 'Mar', sesiones: 185, entregas: 52 },
  { day: 'Mié', sesiones: 210, entregas: 61 },
  { day: 'Jue', sesiones: 165, entregas: 45 },
  { day: 'Vie', sesiones: 230, entregas: 78 },
  { day: 'Sáb', sesiones: 90, entregas: 12 },
  { day: 'Dom', sesiones: 45, entregas: 5 },
];

const courseDistribution = [
  { name: 'Seguridad Vial', value: 380, color: 'hsl(210, 80%, 55%)' },
  { name: 'Primeros Auxilios', value: 245, color: 'hsl(150, 65%, 45%)' },
  { name: 'Normatividad', value: 190, color: 'hsl(280, 65%, 55%)' },
  { name: 'Mecánica Básica', value: 125, color: 'hsl(35, 85%, 55%)' },
  { name: 'Otros', value: 80, color: 'hsl(0, 0%, 60%)' },
];

const totalStudentsInCourses = courseDistribution.reduce((acc, c) => acc + c.value, 0);

export function AdminDashboard() {
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);

  useEffect(() => {
    fetch('http://localhost:3200/api/auth/solicitudes')
      .then(r => r.json())
      .then(data => {
        const pending = Array.isArray(data) ? data.filter((s: any) => s.estado === 'PENDIENTE').length : 0;
        setSolicitudesPendientes(pending);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="animate-in fade-in duration-700">
      <header className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Panel Administrativo</h1>
          <p className="text-muted-foreground mt-1">Visión de estado general de la plataforma y métricas maestras.</p>
        </div>
        <p className="text-xs text-muted-foreground font-medium">
          Última actualización: <span className="text-foreground font-semibold">Ahora</span>
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
              <p className="text-3xl font-black tracking-tight">1,240</p>
              <p className="text-xs text-emerald-500 font-semibold mt-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +12% este mes
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 group-hover:scale-110 transition-transform">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        {/* Cursos en Vivo */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 p-5 shadow-sm hover:shadow-lg transition-all duration-300 group
                        bg-card/70 backdrop-blur-md hover:border-blue-500/40">
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/5 blur-xl group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Cursos en Vivo</p>
              <p className="text-3xl font-black tracking-tight">34</p>
              <p className="text-xs text-muted-foreground mt-2">4 en modo borrador</p>
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
              <p className="text-3xl font-black tracking-tight">4.2<span className="text-lg text-muted-foreground">/5.0</span></p>
              <p className="text-xs text-amber-500 font-semibold mt-2 flex items-center gap-1">
                <Award className="h-3 w-3" /> Excelente rendimiento
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
                <p className="text-xs text-muted-foreground mt-0.5">Sesiones activas y entregas por día</p>
              </div>
              <div className="flex gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Sesiones
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
            <p className="text-xs text-muted-foreground mb-4">{totalStudentsInCourses.toLocaleString()} matrículas totales</p>
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
                    {courseDistribution.map((entry, i) => (
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
              {courseDistribution.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs group/item hover:bg-muted/30 rounded-lg px-2 py-1 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className="font-medium text-foreground">{c.name}</span>
                  </div>
                  <span className="font-bold text-muted-foreground group-hover/item:text-foreground transition-colors">
                    {c.value} <span className="font-normal">({Math.round(c.value / totalStudentsInCourses * 100)}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
