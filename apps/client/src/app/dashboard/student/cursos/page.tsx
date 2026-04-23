"use client";

import { useEffect, useState } from "react";
import { BookOpen, Trophy } from "lucide-react";
import Link from "next/link";
import { useRole } from "@/contexts/RoleContext";

export default function StudentCursosActivos() {
  const { role } = useRole();
  const [cursos, setCursos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCursos();
  }, [role]);

  const fetchCursos = async () => {
    try {
      const res = await fetch(`http://localhost:3200/api/cursos?role=${role}`);
      const data = await res.json();
      setCursos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Mis Cursos Activos</h1>
        <p className="text-muted-foreground mt-1">Explora tu catálogo de capacitación y retoma donde lo dejaste.</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-40">
           <span className="text-muted-foreground font-bold">Cargando cursos...</span>
        </div>
      ) : cursos.length === 0 ? (
        <div className="bg-card border border-border/50 rounded-2xl p-12 text-center shadow-sm">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-bold">Sin cursos asignados</h3>
            <p className="text-muted-foreground mt-2">No tienes cursos activos en este momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cursos.map(curso => (
                <Link key={curso.guid} href={`/cursos/${curso.guid}`} className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-primary/50 group block">
                    <div className="h-32 bg-primary/10 relative flex items-center justify-center overflow-hidden">
                        {curso.imagen_portada ? (
                           // eslint-disable-next-line @next/next/no-img-element
                           <img src={curso.imagen_portada} alt={curso.titulo} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        ) : (
                           <BookOpen className="h-12 w-12 text-primary/30 group-hover:scale-110 transition-transform" />
                        )}
                        <div className="absolute inset-0 border-b border-border/30" />
                    </div>
                    <div className="p-5">
                        <h2 className="font-bold text-lg leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">{curso.titulo}</h2>
                        <div className="flex justify-between items-center mt-6">
                            <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">{curso.estado}</span>
                            <span className="text-sm font-semibold text-primary group-hover:translate-x-1 transition-transform flex items-center gap-1">Entrar <BookOpen className="h-3 w-3" /></span>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
      )}
    </div>
  );
}
