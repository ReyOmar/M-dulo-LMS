'use client';

import { useEffect, useState, useRef } from 'react';
import {
  GraduationCap,
  ArrowRight,
  ShieldCheck,
  Truck,
  Route,
  Award,
  Users,
  BookOpen,
  CheckCircle,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Clock,
  Star,
  Target,
  Shield,
  Zap,
  TrendingUp,
  Heart,
} from 'lucide-react';
import { useConfig, resolveFileUrl } from '@/contexts/ConfigContext';

/* ─── Animated Counter ─── */
function AnimCounter({ end, suffix = '', duration = 2000 }: { end: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            setVal(Math.floor(p * end));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [end, duration]);

  return (
    <div ref={ref}>
      {val.toLocaleString()}
      {suffix}
    </div>
  );
}

/* ─── Scroll Fade-In ─── */
function FadeIn({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVis(true);
      },
      { threshold: 0.15 },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

export default function Home() {
  const { config } = useConfig();
  const platformName = config?.nombre_plataforma || 'PESV Education';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  const services = [
    {
      icon: Truck,
      title: 'Gestión de Flotas',
      desc: 'Control total de vehículos, conductores y rutas con rastreo en tiempo real y reportes automatizados.',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: ShieldCheck,
      title: 'Seguridad Vial PESV',
      desc: 'Implementación completa del Plan Estratégico de Seguridad Vial según normativa nacional vigente.',
      color: 'from-emerald-500 to-green-500',
    },
    {
      icon: BookOpen,
      title: 'Capacitación Continua',
      desc: 'Cursos certificados en seguridad vial, manejo defensivo y normatividad para todo tu equipo.',
      color: 'from-purple-500 to-indigo-500',
    },
    {
      icon: Award,
      title: 'Certificaciones',
      desc: 'Emisión automática de certificados digitales al completar cada módulo de formación.',
      color: 'from-amber-500 to-orange-500',
    },
    {
      icon: Target,
      title: 'Auditorías y Cumplimiento',
      desc: 'Verificación del cumplimiento normativo con auditorías programadas y trazabilidad completa.',
      color: 'from-rose-500 to-pink-500',
    },
    {
      icon: TrendingUp,
      title: 'Análisis y Reportes',
      desc: 'Dashboards inteligentes con métricas de desempeño, siniestralidad y progreso formativo.',
      color: 'from-teal-500 to-cyan-500',
    },
  ];

  const features = [
    {
      icon: Truck,
      title: 'Constructor de Cursos Dinámico',
      desc: 'Crea módulos, lecciones y recursos (videos, PDFs, links) arrastrando y soltando de manera sencilla.',
    },
    {
      icon: BookOpen,
      title: 'Cuestionarios Interactivos',
      desc: 'Evalúa a tus estudiantes con cuestionarios integrados, temporizadores y corrección automática al instante.',
    },
    {
      icon: Award,
      title: 'Generación de Certificados',
      desc: 'Al aprobar los módulos, el sistema genera certificados en PDF con código QR verificable y firmas digitales.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-hidden">
      {/* ══════════ ANIMATED BACKGROUND ══════════ */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] animate-[floatBg_12s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[100px] animate-[floatBg_15s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full bg-emerald-500/10 blur-[100px] animate-[floatBg_10s_ease-in-out_infinite_2s]" />
      </div>

      {/* ══════════ NAVBAR ══════════ */}
      <header
        className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm' : 'bg-transparent'}`}
      >
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 font-bold text-xl text-primary">
            {config?.logo_url ? (
              <img
                src={resolveFileUrl(config.logo_url) || ''}
                alt="Logo"
                className="max-h-12 max-w-[40px] object-contain"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <Truck className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <span className="hidden sm:inline">{platformName}</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#servicios" className="hover:text-primary transition-colors">
              Servicios
            </a>
            <a href="#caracteristicas" className="hover:text-primary transition-colors">
              Características
            </a>
            <a href="#nosotros" className="hover:text-primary transition-colors">
              Nosotros
            </a>
            <a href="#contacto" className="hover:text-primary transition-colors">
              Contacto
            </a>
            <a
              href="/login"
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-all hover:scale-105 shadow-lg shadow-primary/25"
            >
              Ingresar <ArrowRight className="inline h-4 w-4 ml-1" />
            </a>
          </nav>
          <a
            href="/login"
            className="md:hidden bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-bold"
          >
            Ingresar
          </a>
        </div>
      </header>

      <main className="flex-1">
        {/* ══════════ HERO ══════════ */}
        <section className="relative min-h-screen flex items-center justify-center px-6 pt-20">
          {/* Animated road lines */}
          <div className="absolute bottom-0 left-0 w-full h-32 overflow-hidden opacity-10">
            <div className="flex gap-8 animate-[slideRoad_3s_linear_infinite]">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="w-20 h-2 bg-primary rounded-full shrink-0" />
              ))}
            </div>
          </div>

          <div className="max-w-5xl mx-auto text-center">
            <div
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-primary mb-8"
              style={{ animation: 'fadeInUp 0.7s ease forwards' }}
            >
              <Shield className="h-4 w-4" />
              Líderes en Seguridad Vial y Transporte
            </div>

            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-8"
              style={{ animation: 'fadeInUp 0.7s ease 0.15s forwards', opacity: 0 }}
            >
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-foreground/70">
                {config?.landing_hero_titulo1 || 'Transporte Seguro,'}
              </span>
              <br />
              <span
                className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary to-emerald-500 animate-pulse"
                style={{ animationDuration: '3s' }}
              >
                {config?.landing_hero_titulo2 || 'Personal Capacitado'}
              </span>
            </h1>

            <p
              className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground leading-relaxed mb-12"
              style={{ animation: 'fadeInUp 0.7s ease 0.3s forwards', opacity: 0 }}
            >
              {config?.landing_hero_subtitulo ||
                'Plataforma integral para la gestión del Plan Estratégico de Seguridad Vial.'}
            </p>

            <div
              className="flex flex-col sm:flex-row gap-4 justify-center"
              style={{ animation: 'fadeInUp 0.7s ease 0.45s forwards', opacity: 0 }}
            >
              <a
                href="/login"
                className="group inline-flex h-14 items-center justify-center rounded-2xl bg-primary px-10 text-base font-bold text-primary-foreground shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all hover:scale-105"
              >
                Comenzar Ahora
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="#servicios"
                className="inline-flex h-14 items-center justify-center rounded-2xl border-2 border-border bg-card/50 backdrop-blur-sm px-10 text-base font-bold text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                Conocer Más
              </a>
            </div>

            {/* Trust badges */}
            <div
              className="mt-16 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground"
              style={{ animation: 'fadeInUp 0.7s ease 0.6s forwards', opacity: 0 }}
            >
              {[
                { icon: CheckCircle, text: 'Certificación Oficial' },
                { icon: Shield, text: 'Cumplimiento PESV' },
                { icon: Users, text: 'Capacitación en Línea' },
              ].map((b, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-card/50 backdrop-blur-sm border border-border/50 px-4 py-2 rounded-full"
                >
                  <b.icon className="h-4 w-4 text-primary" />
                  <span className="font-medium">{b.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ SERVICES ══════════ */}
        <section id="servicios" className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <FadeIn className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/20 text-primary text-sm font-bold px-4 py-1.5 rounded-full mb-4">
                <Zap className="h-4 w-4" /> Nuestros Servicios
              </div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                Soluciones Integrales en
                <br />
                <span className="text-primary">Seguridad Vial</span>
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
                Todo lo que tu empresa necesita para cumplir con la normativa PESV y proteger a tu equipo en las vías.
              </p>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((s, i) => (
                <FadeIn key={i} delay={i * 0.08}>
                  <div className="group relative bg-card/50 backdrop-blur-md border border-border/50 rounded-3xl p-8 hover:border-primary/50 hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)] transition-all duration-500 hover:-translate-y-2 overflow-hidden h-full">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10">
                      <div
                        className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg`}
                      >
                        <s.icon className="h-7 w-7 text-white" />
                      </div>
                      <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ WHY US ══════════ */}
        <section id="nosotros" className="py-24 px-6 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="max-w-6xl mx-auto">
            <FadeIn className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                ¿Por Qué <span className="text-primary">Elegirnos</span>?
              </h2>
            </FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                {
                  icon: Route,
                  title: 'Experiencia en Ruta',
                  desc: 'Más de 10 años formando conductores profesionales con programas probados en campo.',
                },
                {
                  icon: Shield,
                  title: 'Normativa al Día',
                  desc: 'Contenido constantemente actualizado según las últimas resoluciones de seguridad vial.',
                },
                {
                  icon: Zap,
                  title: 'Plataforma en Línea',
                  desc: 'Capacitación 100% digital, accesible desde cualquier dispositivo, en cualquier momento.',
                },
                {
                  icon: Heart,
                  title: 'Compromiso Real',
                  desc: 'Nuestra misión es salvar vidas. Cada conductor capacitado es una familia más segura.',
                },
              ].map((item, i) => (
                <FadeIn key={i} delay={i * 0.1}>
                  <div className="group flex gap-5 p-6 rounded-2xl bg-card/50 backdrop-blur-md border border-border/50 hover:border-primary/50 hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)] transition-all duration-500 hover:-translate-y-1 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-all duration-500">
                      <item.icon className="h-6 w-6 text-primary group-hover:text-white transition-colors duration-500" />
                    </div>
                    <div className="relative z-10">
                      <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors duration-300">
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ FEATURES (Replaces Testimonials) ══════════ */}
        <section id="caracteristicas" className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <FadeIn className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/20 text-primary text-sm font-bold px-4 py-1.5 rounded-full mb-4">
                <Star className="h-4 w-4" /> Innovación
              </div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                Características de la <span className="text-primary">Plataforma</span>
              </h2>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <FadeIn key={i} delay={i * 0.12}>
                  <div className="group bg-card/50 backdrop-blur-md border border-border/50 rounded-3xl p-8 hover:border-primary/50 hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)] transition-all duration-500 hover:-translate-y-2 h-full flex flex-col relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-all duration-500">
                        <f.icon className="h-8 w-8 text-primary group-hover:text-white transition-colors duration-500" />
                      </div>
                      <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors duration-300">
                        {f.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed flex-1">{f.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ CONTACT ══════════ */}
        <section id="contacto" className="py-24 px-6 bg-gradient-to-b from-transparent to-muted/30">
          <div className="max-w-6xl mx-auto">
            <FadeIn className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">Contáctanos</h2>
              <p className="mt-4 text-muted-foreground text-lg">
                Estamos listos para ayudarte a implementar tu programa PESV.
              </p>
            </FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: Phone,
                  title: 'Teléfono',
                  info: config?.landing_telefono || '+57 300 123 4567',
                  sub: config?.landing_telefono_sub || 'Lun-Vie 8am-6pm',
                },
                {
                  icon: Mail,
                  title: 'Email',
                  info: config?.landing_email || 'contacto@pesveducation.com',
                  sub: config?.landing_email_sub || 'Respuesta en 24h',
                },
                {
                  icon: MapPin,
                  title: 'Oficina',
                  info: config?.landing_oficina || 'Bogotá, Colombia',
                  sub: config?.landing_oficina_sub || 'Cra 7 #45-21, Oficina 302',
                },
              ].map((c, i) => (
                <FadeIn key={i} delay={i * 0.1}>
                  <div className="group text-center bg-card/50 backdrop-blur-md border border-border/50 rounded-3xl p-8 hover:border-primary/50 hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)] transition-all duration-500 hover:-translate-y-2 relative overflow-hidden h-full flex flex-col">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
                      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary group-hover:text-white transition-all duration-500">
                        <c.icon className="h-6 w-6 text-primary group-hover:text-white transition-colors duration-500" />
                      </div>
                      <h3 className="font-bold text-lg group-hover:text-primary transition-colors duration-300">
                        {c.title}
                      </h3>
                      <p className="text-primary font-bold mt-2 text-lg">{c.info}</p>
                      <p className="text-sm text-muted-foreground mt-1">{c.sub}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="border-t border-border/40 bg-card/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 font-bold text-xl text-primary mb-4">
                {config?.logo_url ? (
                  <img
                    src={resolveFileUrl(config.logo_url) || ''}
                    alt="Logo"
                    className="max-h-10 max-w-[40px] object-contain"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                    <Truck className="h-5 w-5 text-primary-foreground" />
                  </div>
                )}
                {platformName}
              </div>
              <p className="text-muted-foreground max-w-sm leading-relaxed">
                {config?.landing_footer_texto ||
                  'Plataforma líder en capacitación y certificación de seguridad vial para empresas de transporte de carga.'}
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Plataforma</h4>
              <div className="space-y-3 text-sm text-muted-foreground">
                <a href="#servicios" className="block hover:text-primary transition-colors">
                  Servicios
                </a>
                <a href="#caracteristicas" className="block hover:text-primary transition-colors">
                  Características
                </a>
                <a href="#nosotros" className="block hover:text-primary transition-colors">
                  Nosotros
                </a>
                <a href="/login" className="block hover:text-primary transition-colors">
                  Iniciar Sesión
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <div className="space-y-3 text-sm text-muted-foreground">
                <a href="/legal" className="block hover:text-primary transition-colors">
                  Política de Privacidad
                </a>
                <a href="/legal" className="block hover:text-primary transition-colors">
                  Términos de Uso
                </a>
                <a href="/legal" className="block hover:text-primary transition-colors">
                  Protección de Datos
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-border/40 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
            <p>
              © {new Date().getFullYear()} {platformName}. Todos los derechos reservados.
            </p>
            <p className="mt-3 md:mt-0 flex items-center gap-1">
              <Shield className="h-4 w-4 text-primary" /> Comprometidos con la seguridad vial
            </p>
          </div>
        </div>
      </footer>

      {/* Animations defined in globals.css: fadeInUp, slideRoad, floatBg */}
    </div>
  );
}
