"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowRight, ShieldCheck, Map, Navigation, Truck, CarFront, FileCheck, Award, AlertTriangle, ChevronRight, Activity, Radar, Compass, Database, TerminalSquare, Settings2, BarChart4, Shield, CheckCircle2 } from "lucide-react";
import { useConfig } from "@/contexts/ConfigContext";

/* ─── Scroll Fade-In Component ─── */
function FadeIn({ children, className = "", delay = 0, direction = "up" }: { children: React.ReactNode; className?: string; delay?: number; direction?: "up" | "left" | "right" | "scale" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const getTransform = () => {
    if (vis) return "translate(0) scale(1)";
    if (direction === "up") return "translateY(30px)";
    if (direction === "left") return "translateX(-30px)";
    if (direction === "right") return "translateX(30px)";
    if (direction === "scale") return "scale(0.95)";
    return "translate(0)";
  };

  return (
    <div ref={ref} className={className} style={{ 
      opacity: vis ? 1 : 0, 
      transform: getTransform(), 
      transition: `all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}s` 
    }}>
      {children}
    </div>
  );
}

export default function Home() {
  const { config } = useConfig();
  const platformName = config?.nombre_plataforma || "PLATAFORMA PESV";
  const [scrolled, setScrolled] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  // Subtle Parallax for technical feel
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const features = [
    { icon: Navigation, title: "Rutas de Formación", desc: "Módulos de capacitación estructurados para operadores de carga y transporte especial.", delay: 0 },
    { icon: AlertTriangle, title: "Gestión de Riesgos", desc: "Evaluaciones técnicas para medir la capacidad de respuesta ante incidentes viales.", delay: 0.1 },
    { icon: Award, title: "Emisión Documental", desc: "Generación automatizada de certificados con trazabilidad legal y administrativa.", delay: 0.2 },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#020202] text-[#e0e0e0] relative overflow-hidden font-sans selection:bg-primary/30 selection:text-white">
      
      {/* ══════════ CORPORATE / TECHNICAL BACKGROUND ══════════ */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#020202]">
        {/* Subtle dot matrix grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] bg-[size:32px_32px]" style={{ transform: `translate(${mousePos.x * 0.2}px, ${mousePos.y * 0.2}px)` }} />
        
        {/* Architectural lines */}
        <div className="absolute left-[10%] top-0 bottom-0 w-px bg-white/5" />
        <div className="absolute right-[10%] top-0 bottom-0 w-px bg-white/5" />
        
        {/* Controlled, minimal accent glows (Not overwhelming) */}
        <div className="absolute top-0 right-[20%] w-[500px] h-[500px] bg-primary/5 blur-[150px] rounded-full mix-blend-screen pointer-events-none" />
      </div>

      {/* ══════════ HEADER / NAVIGATION ══════════ */}
      <header className={`fixed top-0 w-full z-50 transition-colors duration-300 ${scrolled ? 'bg-[#050505]/95 backdrop-blur-md border-b border-white/10 py-4 shadow-lg' : 'bg-transparent border-b border-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {config?.logo_url ? (
              <img src={config.logo_url} alt="Logo" className="max-h-10 max-w-[160px] object-contain drop-shadow-lg" />
            ) : (
              <div className="h-10 w-10 bg-primary/20 border border-primary flex items-center justify-center rounded">
                <Shield className="h-5 w-5 text-primary" />
              </div>
            )}
            {!config?.logo_url && <span className="font-bold text-lg tracking-[0.2em] uppercase text-white/90">{platformName}</span>}
          </div>
          
          <nav className="hidden md:flex items-center gap-10 text-[11px] font-bold text-white/50 uppercase tracking-[0.2em]">
            <a href="#arquitectura" className="hover:text-primary transition-colors flex items-center gap-2"><Database className="h-3 w-3" /> Infraestructura</a>
            <a href="#operacion" className="hover:text-primary transition-colors flex items-center gap-2"><TerminalSquare className="h-3 w-3" /> Protocolos</a>
            <a href="/login" className="flex items-center gap-2 border border-white/20 hover:border-primary text-white/90 hover:text-white bg-white/5 px-6 py-2 rounded-xl transition-all">
              SISTEMA <ArrowRight className="h-3 w-3" />
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ══════════ HERO (SERIOUS & COMMAND-CENTER STYLE) ══════════ */}
        <section className="relative min-h-[90vh] flex items-center px-6 pt-24 pb-12 z-10">
          <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">
            
            <div className="text-left">
              <div className="inline-flex items-center gap-3 border border-primary/30 bg-primary/10 px-4 py-1.5 text-[10px] font-bold text-primary mb-8 uppercase tracking-[0.3em] animate-fade-in-up rounded-full">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Panel de Control PESV
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter leading-[1.05] mb-6 uppercase animate-fade-in-up text-white/90" style={{ animationDelay: '0.1s' }}>
                Gestión de <br />
                <span className="text-primary font-black">Seguridad Vial</span>
              </h1>

              <p className="text-base md:text-lg text-white/50 leading-relaxed mb-10 max-w-xl animate-fade-in-up border-l border-primary/50 pl-5 font-medium" style={{ animationDelay: '0.2s' }}>
                Sistema centralizado para la capacitación, evaluación técnica y trazabilidad del personal operativo. Cumplimiento normativo asegurado mediante procesos auditables.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <a href="/login" className="inline-flex h-14 items-center justify-center bg-primary hover:bg-primary/90 text-white px-10 text-xs font-bold uppercase tracking-[0.2em] rounded-xl transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                  Acceso a la Plataforma <ChevronRight className="ml-2 h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Visual Element: Command Center Widget */}
            <div className="hidden lg:block relative h-[500px] animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className="absolute inset-0 border border-white/10 bg-[#0a0a0a] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* Widget Header */}
                <div className="h-10 border-b border-white/10 bg-[#111] flex items-center px-4 justify-between">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                  </div>
                  <div className="text-[9px] uppercase tracking-[0.2em] text-white/40">Terminal de Telemetría</div>
                </div>
                {/* Widget Body */}
                <div className="flex-1 p-6 flex flex-col gap-4 relative">
                   <div className="absolute top-0 right-0 p-4 opacity-10">
                     <Radar className="w-48 h-48 animate-spin-slow" />
                   </div>
                   
                   {/* Data rows */}
                   <div className="flex items-center justify-between border-b border-white/5 pb-4 relative z-10">
                     <div className="flex items-center gap-3">
                       <Truck className="h-5 w-5 text-white/50" />
                       <div>
                         <p className="text-[10px] text-white/40 uppercase tracking-wider">Estado Flota</p>
                         <p className="text-sm font-bold text-white">100% OPERATIVA</p>
                       </div>
                     </div>
                     <Activity className="h-5 w-5 text-emerald-500" />
                   </div>

                   <div className="flex items-center justify-between border-b border-white/5 pb-4 relative z-10">
                     <div className="flex items-center gap-3">
                       <ShieldCheck className="h-5 w-5 text-white/50" />
                       <div>
                         <p className="text-[10px] text-white/40 uppercase tracking-wider">Certificaciones PESV</p>
                         <p className="text-sm font-bold text-primary">AUDITORÍA APROBADA</p>
                       </div>
                     </div>
                     <CheckCircle2 className="h-5 w-5 text-primary" />
                   </div>
                   
                   {/* Animated Progress Bars */}
                   <div className="mt-4 space-y-4 relative z-10">
                     <div>
                       <div className="flex justify-between text-[10px] text-white/40 uppercase tracking-wider mb-2">
                         <span>Capacitación en Curso</span>
                         <span>85%</span>
                       </div>
                       <div className="h-1.5 w-full bg-white/5 overflow-hidden rounded-full">
                         <div className="h-full bg-primary w-[85%] animate-highway-scroll rounded-full" style={{ backgroundSize: '20px 100%', backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)' }} />
                       </div>
                     </div>
                   </div>
                </div>
              </div>
              
              {/* Floating tech badge */}
              <div className="absolute -bottom-6 -left-6 bg-[#111] border border-white/10 p-4 flex items-center gap-4 rounded-2xl shadow-2xl" style={{ transform: `translate(${-mousePos.x * 0.5}px, ${-mousePos.y * 0.5}px)` }}>
                <div className="p-2 border border-primary/30 bg-primary/10 rounded-xl">
                  <BarChart4 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-[9px] uppercase text-white/40 tracking-wider">Monitoreo</p>
                  <p className="text-sm font-bold">Tiempo Real</p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ══════════ INFRAESTRUCTURA (Tarjetas Técnicas Serias) ══════════ */}
        <section id="arquitectura" className="py-24 px-6 border-y border-white/5 bg-[#050505]">
          <div className="max-w-7xl mx-auto">
            <FadeIn className="mb-16 md:flex justify-between items-end" direction="up">
              <div className="max-w-3xl">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tighter uppercase text-white/90 mb-3">Infraestructura del Sistema</h2>
                <p className="text-white/40 text-sm md:text-base leading-relaxed">Herramientas técnicas desarrolladas para la gestión administrativa y operativa del Plan Estratégico de Seguridad Vial.</p>
              </div>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <FadeIn key={i} delay={f.delay} direction="up">
                  <div className="h-full bg-[#0a0a0a] border border-white/5 p-8 transition-colors duration-300 hover:border-primary/50 group relative rounded-3xl overflow-hidden">
                    {/* Top Accent Line */}
                    <div className="absolute top-0 left-0 w-1/3 h-1 bg-primary/50 group-hover:w-full transition-all duration-500" />
                    
                    <div className="flex items-center gap-4 mb-6 relative z-10">
                      <div className="p-3 bg-[#111] border border-white/10 group-hover:border-primary/30 transition-colors rounded-xl">
                        <f.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-bold text-sm uppercase tracking-widest text-white/90">{f.title}</h3>
                    </div>
                    
                    <p className="text-white/40 leading-relaxed text-sm">{f.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ PROTOCOLOS OPERATIVOS (Lista Estructurada) ══════════ */}
        <section id="operacion" className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <FadeIn className="text-center mb-16" direction="up">
              <div className="inline-flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
                <Settings2 className="h-3 w-3" /> Protocolo de Certificación
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tighter uppercase text-white/90">Fases de Aprobación</h2>
            </FadeIn>

            <div className="space-y-6">
              {[
                { id: "01", icon: CarFront, title: "Despliegue Operativo", desc: "Vinculación del usuario al módulo de instrucción teórica." },
                { id: "02", icon: FileCheck, title: "Validación de Conocimientos", desc: "Ejecución de exámenes y simulacros técnicos evaluativos." },
                { id: "03", icon: ShieldCheck, title: "Emisión de Certificados", desc: "Generación del aval digital requerido por los entes de control." },
              ].map((step, i) => (
                <FadeIn key={i} delay={i * 0.15} direction="up">
                  <div className="flex flex-col md:flex-row items-center gap-6 bg-[#0a0a0a] border border-white/5 p-6 hover:bg-[#0c0c0c] transition-colors group rounded-2xl">
                    <div className="flex items-center gap-6 w-full md:w-auto">
                      <span className="text-4xl font-black text-white/5 group-hover:text-primary/20 transition-colors">{step.id}</span>
                      <div className="p-4 bg-[#111] border border-white/10 shrink-0 rounded-xl">
                        <step.icon className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <div className="w-full">
                      <h3 className="font-bold text-base mb-1 uppercase tracking-wider text-white/90">{step.title}</h3>
                      <p className="text-white/40 text-sm">{step.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ DATOS TÉCNICOS (Footprint) ══════════ */}
        <section className="py-16 px-6 bg-[#050505] border-y border-white/5">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-12">
            {[
              { label: "Soporte", value: "Trazabilidad 24/7" },
              { label: "Exportación", value: "Formatos Auditables" },
              { label: "Disponibilidad", value: "Servidores 99.9%" },
              { label: "Seguridad", value: "Cifrado AES-256" },
            ].map((stat, i) => (
              <FadeIn key={i} delay={i * 0.1} direction="up">
                <div className="border-l-2 border-primary/40 pl-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-2">{stat.label}</p>
                  <p className="font-bold text-sm tracking-wider text-white/80 uppercase">{stat.value}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>
      </main>

      {/* ══════════ FOOTER INSTITUCIONAL ══════════ */}
      <footer className="bg-[#020202] pt-16 pb-8 border-t border-white/5 relative z-30">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            {config?.logo_url ? (
              <img src={config.logo_url} alt="Logo" className="max-h-8 max-w-[140px] object-contain grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all" />
            ) : (
              <Shield className="h-5 w-5 text-white/30" />
            )}
            {!config?.logo_url && <span className="font-bold tracking-widest text-sm text-white/30 uppercase">{platformName}</span>}
          </div>
          <div className="text-[10px] font-bold text-white/30 flex flex-col md:flex-row items-center gap-6 uppercase tracking-[0.2em]">
            <p>© {new Date().getFullYear()} DERECHOS RESERVADOS.</p>
            <div className="flex items-center gap-2 border border-white/10 px-4 py-2 rounded-xl bg-white/5">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               Sistemas Operativos en Línea
            </div>
          </div>
        </div>
      </footer>

      {/* ══════════ CSS ANIMATIONS ══════════ */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes highwayScroll {
          0% { background-position: 0 0; }
          100% { background-position: -40px 0; }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          opacity: 0;
        }
        .animate-highway-scroll {
          animation: highwayScroll 1s linear infinite;
        }
        .animate-spin-slow {
          animation: spin 12s linear infinite;
        }
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
}
