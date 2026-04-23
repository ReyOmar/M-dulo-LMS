import { Play, CalendarClock, Trophy, Star, BookOpen, Clock, ClipboardList } from "lucide-react";

export function StudentDashboard() {
  return (
    <div className="animate-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Hola, Personal en Capacitación</h1>
          <p className="text-muted-foreground mt-1">Sigue aprendiendo, ¡has ingresado activamente 4 días consecutivos!</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full font-bold text-sm shadow-sm ring-1 ring-primary/20">
            <span className="text-lg">📊</span> 4 Días Activo Consecutivos
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main learning widget: Better than Moodle - "Resume from where you left off" */}
          <div className="lg:col-span-2 bg-gradient-to-r from-primary to-primary/80 rounded-3xl p-8 text-primary-foreground shadow-lg flex flex-col md:flex-row gap-6 items-center justify-between relative overflow-hidden group">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000"></div>
              
              <div className="flex-1 z-10">
                  <span className="inline-block px-3 py-1 bg-primary-foreground/20 rounded-full text-xs font-semibold tracking-wider mb-4 border border-primary-foreground/10 text-primary-foreground/90 backdrop-blur-sm">
                      CONTINUAR APRENDIENDO
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">Introducción al Sistema Integrado</h2>
                  <p className="text-primary-foreground/70 mb-6">Módulo 2: Técnicas Avanzadas de Gestión</p>
                  
                  <button className="flex items-center gap-2 bg-white text-primary px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform shadow-md">
                      <Play className="h-4 w-4 fill-primary" /> Retomar Lección
                  </button>
              </div>

              {/* Progress Ring */}
              <div className="relative w-32 h-32 shrink-0 z-10 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" className="stroke-primary-foreground/20" strokeWidth="8" fill="none" />
                      <circle cx="50" cy="50" r="40" className="stroke-white" strokeWidth="8" fill="none" strokeDasharray="251.2" strokeDashoffset="113.04" strokeLinecap="round" />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-white">
                      <span className="text-2xl font-bold">55%</span>
                  </div>
              </div>
          </div>

          {/* Deadlines Widget */}
          <div className="lg:col-span-1 bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">Próximos Vencimientos</h3>
                  <CalendarClock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-4 flex-1">
                  <div className="flex gap-3 items-start relative pb-4">
                      {/* Timeline line */}
                      <div className="absolute left-1.5 top-5 w-0.5 h-full bg-border -z-10"></div>
                      <div className="w-3 h-3 rounded-full bg-destructive ring-4 ring-card mt-1 shrink-0"></div>
                      <div>
                          <p className="font-semibold text-sm">Evaluación Parcial 1</p>
                          <p className="text-xs text-destructive font-medium mt-1">Hoy, 23:59 PM</p>
                      </div>
                  </div>
                  <div className="flex gap-3 items-start relative pb-4">
                      <div className="w-3 h-3 rounded-full bg-amber-500 ring-4 ring-card mt-1 shrink-0"></div>
                      <div>
                          <p className="font-semibold text-sm">Práctica de Ética</p>
                          <p className="text-xs text-muted-foreground mt-1">Mañana, 23:59 PM</p>
                      </div>
                  </div>
                  <div className="flex gap-3 items-start relative">
                      <div className="w-3 h-3 rounded-full bg-primary/40 ring-4 ring-card mt-1 shrink-0"></div>
                      <div>
                          <p className="font-semibold text-sm">Foro de Discusión</p>
                          <p className="text-xs text-muted-foreground mt-1">Viernes, 23:59 PM</p>
                      </div>
                  </div>
              </div>
              <button className="w-full text-center text-xs font-semibold text-primary mt-4 py-2 hover:bg-primary/5 rounded-lg transition-colors">
                  Ver Calendario de Entregas Completas
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Mis Entregables Activos</h2>
                <a href="#" className="text-sm font-medium text-primary hover:underline">Ver repositorio</a>
              </div>
              <div className="space-y-4">
                  
                  {/* Upload Assignment Action Widget */}
                  <div className="p-5 rounded-xl border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 transition-colors group cursor-pointer flex flex-col items-center justify-center text-center">
                      <div className="h-12 w-12 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-3">
                          <ClipboardList className="h-6 w-6" />
                      </div>
                      <h4 className="font-bold text-primary group-hover:text-primary/80">Subir Archivo de Práctica</h4>
                      <p className="text-xs text-primary/70 mt-1 max-w-[250px]">Arrastra tu documento (PDF, DOCX) o haz clic para subir tu evaluación de riesgos.</p>
                      <button className="mt-4 text-xs font-bold px-4 py-2 bg-primary text-white rounded-lg shadow-sm">
                          Seleccionar Archivo
                      </button>
                  </div>

                  <div className="p-4 rounded-xl border border-border/40 hover:border-primary/40 transition-colors group">
                      <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-secondary/10 text-secondary rounded-lg flex items-center justify-center shrink-0">
                                  <BookOpen className="h-5 w-5" />
                              </div>
                              <h4 className="font-semibold group-hover:text-primary transition-colors">Lectura: Normativa Vigente</h4>
                          </div>
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                          <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-secondary w-[100%] rounded-full" />
                          </div>
                          <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                              <Trophy className="h-3 w-3" /> Completado
                          </span>
                      </div>
                  </div>
              </div>
          </section>

          <section className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Historial de Certificaciones</h2>
                <a href="#" className="text-sm font-medium text-primary hover:underline">Ver repositorio oficial</a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col justify-between p-5 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 hover:border-primary/40 transition-colors">
                    <div className="flex justify-between items-start">
                        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center mb-3">
                            <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-[10px] uppercase font-bold px-2 py-1 bg-primary text-white rounded-full">Oficial</span>
                    </div>
                    <div>
                        <p className="font-bold text-sm">Prevención de Riesgos V.</p>
                        <p className="text-xs text-muted-foreground mt-1">Emitido: 10 Ago, 2026 - 40h</p>
                    </div>
                    <button className="text-xs font-semibold px-3 py-2 bg-card border border-border rounded-lg mt-4 text-center hover:bg-muted transition-colors">Descargar PDF</button>
                </div>
                
                <div className="flex flex-col justify-between p-5 rounded-xl bg-gradient-to-br from-muted/50 to-transparent border border-border hover:border-primary/40 transition-colors opacity-60">
                    <div className="flex justify-between items-start">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mb-3">
                            <Star className="h-5 w-5 text-muted-foreground" />
                        </div>
                    </div>
                    <div>
                        <p className="font-bold text-sm text-foreground">Introducción al S. Integrado</p>
                        <p className="text-xs text-muted-foreground mt-1">Módulo 2 en Progreso...</p>
                    </div>
                    <div className="h-8 mt-4"></div>
                </div>
            </div>
          </section>
      </div>
    </div>
  );
}
