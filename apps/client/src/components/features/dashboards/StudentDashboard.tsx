'use client';

import { useEffect, useState, useRef } from 'react';
import { Play, BookOpen, Clock, GraduationCap, Bell, ChevronLeft, ChevronRight, Loader2, X, Flame } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRole } from "@/contexts/RoleContext";
import api from "@/lib/api";

export function StudentDashboard() {
  const { user } = useRole();
  const router = useRouter();

  const [cursos, setCursos] = useState<any[]>([]);
  const [metricas, setMetricas] = useState<any>(null);
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [progreso, setProgreso] = useState<{completados: number, total: number}>({completados: 0, total: 0});
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [activeDays, setActiveDays] = useState<number[]>([]);

  useEffect(() => {
    if (user?.guid) {
      fetchData();
    }
  }, [user?.guid]);

  // Close notification panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchData = async () => {
    try {
      const [cursosRes, metricasRes, notifsRes] = await Promise.all([
        api.get(`/cursos?role=student&usuario_guid=${user.guid}`),
        api.get(`/cursos/student/metricas?usuario_guid=${user.guid}`),
        api.get(`/cursos/student/notificaciones?usuario_guid=${user.guid}`)
      ]);
      const [cursosData, metricasData, notifsData] = await Promise.all([
        cursosRes.data,
        metricasRes.data,
        notifsRes.data
      ]);
      const cursosArr = Array.isArray(cursosData) ? cursosData : [];
      setCursos(cursosArr);
      setMetricas(metricasData);
      setNotificaciones(Array.isArray(notifsData) ? notifsData : []);

      // Fetch progress for the first (last active) course
      if (cursosArr.length > 0) {
        try {
          const progRes = await api.get(`/cursos/student/progreso?usuario_guid=${user.guid}&curso_guid=${cursosArr[0].guid}`);
          const progData = await progRes.data;
          setProgreso({
            completados: progData.completados?.length || 0,
            total: progData.total_recursos || 0
          });
        } catch {}
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const markNotifRead = async (id: number) => {
    try {
      await api.patch(`/cursos/student/notificaciones/${id}/leer`);
      setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    } catch (e) { console.error(e); }
  };

  const unreadCount = notificaciones.filter(n => !n.leida).length;
  const lastCurso = cursos.length > 0 ? cursos[0] : null;

  // --- Calendar helpers ---
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const today = new Date();
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dayNames = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

  const prevMonth = () => setCalendarDate(new Date(calYear, calMonth - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(calYear, calMonth + 1, 1));

  // Fetch active days when calendar month changes
  useEffect(() => {
    if (user?.guid) {
      api.get(`/cursos/student/dias-activos?usuario_guid=${user.guid}&year=${calYear}&month=${calMonth}`)
        .then(r => r.data)
        .then(data => setActiveDays(Array.isArray(data.dias) ? data.dias : []))
        .catch(() => setActiveDays([]));
    }
  }, [user?.guid, calYear, calMonth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <header className="flex justify-between items-start mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Hola, {user?.nombre || 'Estudiante'} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Bienvenido de vuelta a tu espacio de capacitación.
          </p>
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2.5 rounded-xl bg-card border border-border hover:bg-muted transition-colors shadow-sm"
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-background">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Panel */}
          {showNotifs && (
            <div className="absolute right-0 top-12 w-96 max-h-[480px] bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                <h3 className="font-bold text-sm">Notificaciones</h3>
                <button onClick={() => setShowNotifs(false)} className="p-1 hover:bg-muted rounded-lg transition-colors">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[400px]">
                {notificaciones.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    <Bell className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p>No tienes notificaciones aún.</p>
                  </div>
                ) : (
                  notificaciones.map(n => (
                    <div
                      key={n.id}
                      onClick={() => !n.leida && markNotifRead(n.id)}
                      className={`p-4 border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors ${!n.leida ? 'bg-primary/5' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        {!n.leida && <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />}
                        <div className={!n.leida ? '' : 'ml-5'}>
                          <p className="text-sm font-semibold">{n.titulo}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.mensaje}</p>
                          <p className="text-[10px] text-muted-foreground mt-2">
                            {new Date(n.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Grid: Continue Learning + Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Continue Learning Widget */}
        <div className="lg:col-span-2 bg-gradient-to-r from-primary to-primary/80 rounded-3xl p-8 text-primary-foreground shadow-lg flex flex-col md:flex-row gap-6 items-center justify-between relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />

          <div className="flex-1 z-10">
            <span className="inline-block px-3 py-1 bg-primary-foreground/20 rounded-full text-xs font-semibold tracking-wider mb-4 border border-primary-foreground/10 text-primary-foreground/90 backdrop-blur-sm">
              CONTINUAR APRENDIENDO
            </span>
            {lastCurso ? (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">{lastCurso.titulo}</h2>
                <p className="text-primary-foreground/70 mb-6">
                  {lastCurso.modulos?.length || 0} módulos · {progreso.completados}/{progreso.total} recursos completados
                </p>
                <button
                  onClick={() => router.push(`/cursos/${lastCurso.guid}`)}
                  className="flex items-center gap-2 bg-white text-primary px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform shadow-md"
                >
                  <Play className="h-4 w-4 fill-primary" /> Retomar Curso
                </button>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-2">Sin cursos asignados</h2>
                <p className="text-primary-foreground/70">Contacta con tu administrador para que te asigne cursos.</p>
              </>
            )}
          </div>

          {/* Progress Ring */}
          {lastCurso && (
            <div className="relative w-28 h-28 shrink-0 z-10 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" className="stroke-primary-foreground/20" strokeWidth="8" fill="none" />
                <circle cx="50" cy="50" r="40" className="stroke-white" strokeWidth="8" fill="none" strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - (progreso.total > 0 ? progreso.completados / progreso.total : 0))} strokeLinecap="round" style={{transition: 'stroke-dashoffset 0.8s ease'}} />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-white">
                <span className="text-xl font-bold">{progreso.total > 0 ? Math.round((progreso.completados / progreso.total) * 100) : 0}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="bg-card border border-border/50 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <h3 className="font-bold text-sm">{monthNames[calMonth]} {calYear}</h3>
            <button onClick={nextMonth} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {dayNames.map(d => (
              <div key={d} className="text-[10px] font-bold text-muted-foreground uppercase py-1">{d}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = calYear === today.getFullYear() && calMonth === today.getMonth() && day === today.getDate();
              const isActive = activeDays.includes(day);
              return (
                <div
                  key={day}
                  className={`relative text-xs font-medium py-1.5 rounded-lg transition-colors ${
                    isToday
                      ? 'bg-primary text-primary-foreground font-bold'
                      : isActive
                        ? 'bg-emerald-500/10 text-emerald-600 font-bold'
                        : 'text-foreground hover:bg-muted/50'
                  }`}
                  title={isActive ? 'Día con actividad' : undefined}
                >
                  {day}
                  {isActive && (
                    <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full ${isToday ? 'bg-primary-foreground' : 'bg-emerald-500'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
            <Clock className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{Number(metricas?.total_horas_invertidas || 0).toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground font-medium">Horas en Capacitación</p>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
            <GraduationCap className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{metricas?.cursos_completados || 0}</p>
            <p className="text-xs text-muted-foreground font-medium">Cursos Completados</p>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 bg-purple-500/10 rounded-xl flex items-center justify-center shrink-0">
            <BookOpen className="h-6 w-6 text-purple-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{cursos.length}</p>
            <p className="text-xs text-muted-foreground font-medium">Cursos Activos</p>
          </div>
        </div>
      </div>
    </div>
  );
}
