"use client";

import { Award } from "lucide-react";

export default function CertificadosPage() {
  return (
    <div className="animate-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Mis Certificados PDF</h1>
        <p className="text-muted-foreground mt-1">Descarga tus certificados de capacitación completada.</p>
      </header>

      <div className="bg-card border border-border/50 rounded-2xl p-16 text-center shadow-sm">
        <Award className="h-16 w-16 text-muted-foreground/30 mx-auto mb-6" />
        <h3 className="text-xl font-bold mb-2">Próximamente</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Los certificados de finalización se generarán automáticamente cuando completes todos los módulos de un curso.
        </p>
      </div>
    </div>
  );
}
