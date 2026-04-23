'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Lock, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRole } from "@/contexts/RoleContext";

export function TeacherDashboard() {
  const { user } = useRole();
  const router = useRouter();

  const [cursos, setCursos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.guid) fetchCursos();
  }, [user?.guid]);

  const fetchCursos = async () => {
    try {
      const res = await fetch(`http://localhost:3200/api/cursos?role=teacher&profesor_guid=${user?.guid}`);
      const data = await res.json();
      setCursos(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-700">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Tablero del Examinador</h1>
        <p className="text-muted-foreground mt-1">Aquí verás los cursos que la Administración te ha asignado para supervisar.</p>
      </header>

      {cursos.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-card rounded-2xl border border-dashed border-border p-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">Sin cursos asignados</h2>
          <p className="text-muted-foreground max-w-sm">
            Aún no tienes cursos asignados. Contacta con un administrador para que te asigne cursos para supervisar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cursos.map((curso: any) => (
            <div
              key={curso.guid}
              onClick={() => router.push(`/cursos/${curso.guid}`)}
              className="flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-md transition-all shadow-sm cursor-pointer group"
            >
              <div className="h-32 bg-gradient-to-br from-primary/10 to-secondary/10 relative flex items-center justify-center overflow-hidden">
                {curso.imagen_portada ? (
                  <img src={curso.imagen_portada} alt={curso.titulo} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <BookOpen className="h-12 w-12 text-primary/30 group-hover:scale-110 transition-transform" />
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h2 className="font-bold text-lg leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">
                  {curso.titulo}
                </h2>
                <div className="flex justify-between items-center mt-auto pt-4 border-t border-border/30">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                    curso.estado === 'PUBLICADO'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {curso.estado}
                  </span>
                  <span className="text-sm font-semibold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Administrar <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Slot vacío decorativo */}
          <div className="flex flex-col bg-muted/20 border border-dashed border-border rounded-2xl items-center justify-center p-6 text-center opacity-50">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-3">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-muted-foreground text-sm">Sin más asignaciones</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[180px]">Pide a un administrador que te asigne otro curso.</p>
          </div>
        </div>
      )}
    </div>
  );
}
