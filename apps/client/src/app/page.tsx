import { GraduationCap, ArrowRight, ShieldCheck, BookOpen } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-hidden">
      {/* Dynamic Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <header className="px-6 h-20 flex items-center border-b border-border/40 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-primary drop-shadow-sm">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span>PESV Education</span>
          </div>
          <nav className="hidden md:flex gap-6 items-center text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Características</a>
            <a href="#cursos" className="hover:text-primary transition-colors">Cursos</a>
            <div className="h-4 w-px bg-border"></div>
            <a href="/login" className="text-foreground hover:text-primary transition-colors">Ingresar</a>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center">
        {/* Hero Section */}
        <section className="w-full py-24 md:py-32 lg:py-48 px-6 flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <ShieldCheck className="mr-2 h-4 w-4" />
            <span>Entorno Institucional Seguro</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-primary/80 pb-2">
            Plataforma de Capacitación y Evaluación Continua
          </h1>
          
          <p className="mt-6 max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
            Sistema de gestión de aprendizaje corporativo diseñado para centralizar cursos, realizar evaluaciones automáticas y emitir certificaciones de progreso.
          </p>
          
          <div className="mt-10 flex gap-4">
            <a href="/login" className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              Ingresar al Portal <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </section>

        {/* Features Grid */}
        <section className="w-full max-w-6xl px-6 py-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="group rounded-3xl border border-border/50 bg-card/50 p-8 hover:bg-card hover:border-primary/50 transition-all shadow-sm hover:shadow-md">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-3">Seguro y Privado</h3>
            <p className="text-muted-foreground">Sistema de base de datos y autenticación totalmente aislado con auditoría completa de acciones.</p>
          </div>
          
          <div className="group rounded-3xl border border-border/50 bg-card/50 p-8 hover:bg-card hover:border-primary/50 transition-all shadow-sm hover:shadow-md">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-3">Gestión de Cursos</h3>
            <p className="text-muted-foreground">Creación de módulos, lecciones y recursos interactivos con autocalificación integrada.</p>
          </div>
          
          <div className="group rounded-3xl border border-border/50 bg-card/50 p-8 hover:bg-card hover:border-primary/50 transition-all shadow-sm hover:shadow-md">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-3">Progreso Visual</h3>
            <p className="text-muted-foreground">Rastreo de completitud, sistema de rachas (streaks) y badges de gamificación educativa.</p>
          </div>
        </section>
      </main>
      
      <footer className="border-t border-border/40 py-8 px-6 mt-12 bg-muted/20">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
          <p>© 2026 PESV Education Platform.</p>
          <p className="mt-4 md:mt-0 flex items-center gap-1">Diseñado para alto rendimiento y seguridad corporativa</p>
        </div>
      </footer>
    </div>
  );
}
