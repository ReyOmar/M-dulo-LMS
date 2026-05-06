"use client";

import { ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";
import { useConfig } from "@/contexts/ConfigContext";

export default function LegalPage() {
  const { config } = useConfig();
  const platformName = config?.nombre_plataforma || "PESV Education";

  const defaultTerminos = `Bienvenido a ${platformName}. Al acceder y utilizar nuestra plataforma de capacitación y certificación, aceptas estar sujeto a estos términos y condiciones. Todo el contenido educativo, evaluaciones y recursos disponibles en esta plataforma son propiedad intelectual exclusiva o están licenciados a nuestra organización.\n\nEl usuario se compromete a hacer un uso adecuado de los contenidos y servicios ofrecidos, no empleándolos para incurrir en actividades ilícitas o contrarias a la buena fe y al orden público.`;

  const defaultPrivacidad = `En ${platformName}, valoramos tu privacidad. Recopilamos información personal (como nombres, correos electrónicos e historial de capacitación) exclusivamente para proporcionar, mantener y mejorar nuestros servicios, así como para la emisión de certificados oficiales.\n\nNo compartimos, vendemos ni alquilamos tu información personal a terceros para fines de marketing sin tu consentimiento explícito, excepto cuando sea requerido por autoridades competentes en el marco del cumplimiento del Plan Estratégico de Seguridad Vial (PESV).`;

  const defaultDatos = `De acuerdo con las leyes nacionales de protección de datos personales, garantizamos a todos nuestros usuarios el derecho a conocer, actualizar y rectificar la información que se haya recogido sobre ellos en nuestras bases de datos.\n\nSi deseas ejercer tus derechos sobre tus datos, puedes enviar una solicitud formal a través de los canales de contacto especificados en la página principal.`;

  const terminos = config?.legal_terminos || defaultTerminos;
  const privacidad = config?.legal_privacidad || defaultPrivacidad;
  const datos = config?.legal_datos || defaultDatos;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* HEADER */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Volver al Inicio</span>
          </Link>
          <div className="flex items-center gap-2 font-bold text-primary">
            <Shield className="h-5 w-5" />
            {platformName}
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-black mb-8">Información Legal y Privacidad</h1>
          <p className="text-muted-foreground text-lg mb-12">
            Última actualización: {new Date().toLocaleDateString('es-ES')}
          </p>

          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">1. Términos de Uso</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{terminos}</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">2. Política de Privacidad</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{privacidad}</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">3. Protección de Datos (Habeas Data)</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{datos}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">4. Emisión de Certificados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Los certificados emitidos por la plataforma contienen un código de verificación único que garantiza su autenticidad. La falsificación o alteración de estos documentos constituye una violación a estos términos y puede acarrear sanciones legales.
            </p>
          </section>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground bg-card/20">
        <p>© {new Date().getFullYear()} {platformName}. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
