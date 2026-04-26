"use client";

import { useEffect, useState } from "react";
import { BookOpen, Users, GraduationCap, Presentation, Plus, X, Loader2, CheckCircle, Search, UserPlus, UserMinus } from "lucide-react";
import { PageLoader } from "@/components/PageLoader";

interface Curso {
  guid: string;
  titulo: string;
  estado: string;
  profesor_guid: string;
}

interface Usuario {
  guid: string;
  nombre: string;
  apellido: string;
  email: string;
}

interface Matricula {
  id: number;
  usuario_guid: string;
  curso_guid: string;
  fecha_matricula: string;
  usuario: Usuario;
}

export default function AsignacionCursosPage() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [profesores, setProfesores] = useState<Usuario[]>([]);
  const [estudiantes, setEstudiantes] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  // Student assignment state
  const [selectedCursoEstudiante, setSelectedCursoEstudiante] = useState<string>('');
  const [matriculados, setMatriculados] = useState<Matricula[]>([]);
  const [loadingMatriculas, setLoadingMatriculas] = useState(false);
  const [searchEstudiante, setSearchEstudiante] = useState('');

  // Professor assignment state
  const [selectedCursoProfesor, setSelectedCursoProfesor] = useState<string>('');
  const [searchProfesor, setSearchProfesor] = useState('');

  // Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [cursosRes, profesoresRes, estudiantesRes] = await Promise.all([
        fetch('http://localhost:3200/api/cursos?role=admin'),
        fetch('http://localhost:3200/api/cursos/profesores'),
        fetch('http://localhost:3200/api/cursos/estudiantes')
      ]);
      const [cursosData, profesoresData, estudiantesData] = await Promise.all([
        cursosRes.json(), profesoresRes.json(), estudiantesRes.json()
      ]);
      setCursos(Array.isArray(cursosData) ? cursosData : []);
      setProfesores(Array.isArray(profesoresData) ? profesoresData : []);
      setEstudiantes(Array.isArray(estudiantesData) ? estudiantesData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- STUDENT ENROLLMENT ---

  const fetchMatriculas = async (cursoGuid: string) => {
    setLoadingMatriculas(true);
    try {
      const res = await fetch(`http://localhost:3200/api/cursos/matriculas/${cursoGuid}`);
      const data = await res.json();
      setMatriculados(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMatriculas(false);
    }
  };

  const handleSelectCursoEstudiante = (guid: string) => {
    setSelectedCursoEstudiante(guid);
    if (guid) fetchMatriculas(guid);
    else setMatriculados([]);
  };

  const matricularEstudiante = async (usuario_guid: string) => {
    if (!selectedCursoEstudiante) return;
    try {
      await fetch(`http://localhost:3200/api/cursos/matriculas/${selectedCursoEstudiante}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_guid })
      });
      showFeedback('success', 'Estudiante matriculado exitosamente');
      fetchMatriculas(selectedCursoEstudiante);
    } catch (err) {
      showFeedback('error', 'Error al matricular');
    }
  };

  const desmatricularEstudiante = async (usuario_guid: string) => {
    if (!selectedCursoEstudiante) return;
    try {
      await fetch(`http://localhost:3200/api/cursos/matriculas/${selectedCursoEstudiante}/${usuario_guid}`, { method: 'DELETE' });
      showFeedback('success', 'Estudiante desmatriculado');
      fetchMatriculas(selectedCursoEstudiante);
    } catch (err) {
      showFeedback('error', 'Error al desmatricular');
    }
  };

  // --- PROFESSOR ASSIGNMENT ---

  const asignarProfesor = async (profesor_guid: string) => {
    if (!selectedCursoProfesor) return;
    try {
      await fetch(`http://localhost:3200/api/cursos/${selectedCursoProfesor}/asignar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profesor_guid })
      });
      showFeedback('success', 'Profesor asignado al curso exitosamente');
      // Update local state
      setCursos(prev => prev.map(c => c.guid === selectedCursoProfesor ? { ...c, profesor_guid } : c));
    } catch (err) {
      showFeedback('error', 'Error al asignar profesor');
    }
  };

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Filtered lists
  const estudiantesNoMatriculados = estudiantes.filter(e =>
    !matriculados.some(m => m.usuario?.guid === e.guid) &&
    `${e.nombre} ${e.apellido} ${e.email}`.toLowerCase().includes(searchEstudiante.toLowerCase())
  );

  const profesoresFiltrados = profesores.filter(p =>
    `${p.nombre} ${p.apellido} ${p.email}`.toLowerCase().includes(searchProfesor.toLowerCase())
  );

  const cursoSeleccionadoProf = cursos.find(c => c.guid === selectedCursoProfesor);
  const profesorActual = cursoSeleccionadoProf ? profesores.find(p => p.guid === cursoSeleccionadoProf.profesor_guid) : null;

  if (loading) {
    return <PageLoader message="Cargando datos de asignación..." />;
  }

  return (
    <div className="animate-in fade-in duration-700">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" /> Asignación de Cursos
        </h1>
        <p className="text-muted-foreground mt-1">Matricula estudiantes y asigna profesores a los cursos de la plataforma.</p>
      </header>

      {/* Feedback Toast */}
      {feedback && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold animate-in slide-in-from-top-2 duration-200 ${
          feedback.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <CheckCircle className="h-4 w-4" /> {feedback.msg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

        {/* ═══════════════════ LEFT: STUDENTS ═══════════════════ */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border bg-emerald-500/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/10 rounded-xl">
                <GraduationCap className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Asignar a Estudiantes</h2>
                <p className="text-xs text-muted-foreground">Matricula o desmatricula estudiantes de un curso</p>
              </div>
            </div>

            <select
              value={selectedCursoEstudiante}
              onChange={e => handleSelectCursoEstudiante(e.target.value)}
              className="w-full p-3 bg-background border border-border rounded-xl text-sm font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
            >
              <option value="">— Seleccionar un curso —</option>
              {cursos.map(c => (
                <option key={c.guid} value={c.guid}>{c.titulo} ({c.estado})</option>
              ))}
            </select>
          </div>

          {selectedCursoEstudiante && (
            <div className="p-5">
              {/* Currently enrolled */}
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Matriculados ({matriculados.length})
              </h3>

              {loadingMatriculas ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : matriculados.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center bg-muted/10 rounded-xl border border-dashed border-border">Sin estudiantes matriculados</p>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto mb-6">
                  {matriculados.map(m => (
                    <div key={m.usuario?.guid || m.id} className="flex items-center justify-between p-3 bg-muted/10 rounded-xl border border-border/30 group hover:border-red-500/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                          {m.usuario?.nombre?.charAt(0)}{m.usuario?.apellido?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{m.usuario?.nombre} {m.usuario?.apellido}</p>
                          <p className="text-xs text-muted-foreground">{m.usuario?.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => desmatricularEstudiante(m.usuario?.guid)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Desmatricular"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add students */}
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                Agregar Estudiantes
              </h3>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar estudiante..."
                  value={searchEstudiante}
                  onChange={e => setSearchEstudiante(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                />
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {estudiantesNoMatriculados.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {searchEstudiante ? 'Sin resultados' : 'Todos los estudiantes ya están matriculados'}
                  </p>
                ) : (
                  estudiantesNoMatriculados.map(est => (
                    <div key={est.guid} className="flex items-center justify-between p-3 bg-muted/5 rounded-xl border border-border/30 hover:border-emerald-500/30 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold">
                          {est.nombre.charAt(0)}{est.apellido.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{est.nombre} {est.apellido}</p>
                          <p className="text-xs text-muted-foreground">{est.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => matricularEstudiante(est.guid)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors opacity-70 group-hover:opacity-100"
                      >
                        <Plus className="h-3 w-3" /> Matricular
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════ RIGHT: PROFESSORS ═══════════════════ */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border bg-blue-500/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/10 rounded-xl">
                <Presentation className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Asignar a Profesores</h2>
                <p className="text-xs text-muted-foreground">Define qué examinador gestiona cada curso</p>
              </div>
            </div>

            <select
              value={selectedCursoProfesor}
              onChange={e => setSelectedCursoProfesor(e.target.value)}
              className="w-full p-3 bg-background border border-border rounded-xl text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="">— Seleccionar un curso —</option>
              {cursos.map(c => (
                <option key={c.guid} value={c.guid}>{c.titulo} ({c.estado})</option>
              ))}
            </select>
          </div>

          {selectedCursoProfesor && (
            <div className="p-5">
              {/* Current professor */}
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                Profesor Actual
              </h3>

              {profesorActual ? (
                <div className="flex items-center gap-3 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 mb-6">
                  <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                    {profesorActual.nombre.charAt(0)}{profesorActual.apellido.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold">{profesorActual.nombre} {profesorActual.apellido}</p>
                    <p className="text-xs text-muted-foreground">{profesorActual.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center bg-muted/10 rounded-xl border border-dashed border-border mb-6">Sin profesor asignado</p>
              )}

              {/* Assign new professor */}
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-blue-500" />
                {profesorActual ? 'Cambiar Profesor' : 'Asignar Profesor'}
              </h3>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar profesor..."
                  value={searchProfesor}
                  onChange={e => setSearchProfesor(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {profesoresFiltrados.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin resultados</p>
                ) : (
                  profesoresFiltrados.map(prof => {
                    const isCurrentProf = cursoSeleccionadoProf?.profesor_guid === prof.guid;
                    return (
                      <div key={prof.guid} className={`flex items-center justify-between p-3 rounded-xl border transition-colors group ${
                        isCurrentProf ? 'bg-blue-500/10 border-blue-500/30' : 'bg-muted/5 border-border/30 hover:border-blue-500/30'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            isCurrentProf ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'
                          }`}>
                            {prof.nombre.charAt(0)}{prof.apellido.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{prof.nombre} {prof.apellido}</p>
                            <p className="text-xs text-muted-foreground">{prof.email}</p>
                          </div>
                        </div>
                        {isCurrentProf ? (
                          <span className="text-xs font-bold text-blue-500 px-3 py-1.5 bg-blue-500/10 rounded-lg">Actual</span>
                        ) : (
                          <button
                            onClick={() => asignarProfesor(prof.guid)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors opacity-70 group-hover:opacity-100"
                          >
                            <Plus className="h-3 w-3" /> Asignar
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
