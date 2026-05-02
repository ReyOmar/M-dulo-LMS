"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui/PageLoader";
import { ArrowLeft, CheckCircle, Clock, Save, AlertTriangle, Send, Trophy, XCircle } from "lucide-react";
import api from "@/lib/api";
import { useAlert } from "@/contexts/AlertContext";

interface QuizOption { id: string; texto: string; }
interface QuizQuestion { id: string; enunciado: string; opciones: QuizOption[]; }
interface QuizConfig { intentos_permitidos: number; tiempo_minutos: number; preguntas: QuizQuestion[]; }

interface QuizStatus {
    intentos_realizados: number;
    mejor_nota: number;
    completado: boolean;
}

export default function StudentQuizPage({ params }: { params: Promise<{ curso_id: string, recurso_guid: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const { showAlert } = useAlert();
    
    const [cursoTitulo, setCursoTitulo] = useState("");
    const [bloqueTitulo, setBloqueTitulo] = useState("");
    const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);
    const [userGuid, setUserGuid] = useState<string>('');
    const [quizStatus, setQuizStatus] = useState<QuizStatus | null>(null);
    
    const [respuestas, setRespuestas] = useState<Record<string, string>>({});
    const [started, setStarted] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    
    // Modals
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showResultModal, setShowResultModal] = useState<{nota: number, correctas: number, total: number} | null>(null);

    useEffect(() => {
        const savedUser = localStorage.getItem("lms_user");
        if (savedUser) {
            try { setUserGuid(JSON.parse(savedUser).guid); } catch {}
        }
    }, []);

    useEffect(() => {
        const fetchQuizData = async () => {
            if (!userGuid) return;
            try {
                const [resCurso, resStatus] = await Promise.all([
                    api.get(`/cursos/${resolvedParams.curso_id}`),
                    api.get(`/cursos/student/quiz/${resolvedParams.recurso_guid}/status?usuario_guid=${userGuid}`)
                ]);
                
                const curso = resCurso.data;
                setCursoTitulo(curso.titulo);
                setQuizStatus(resStatus.data);
                
                // Find the specific resource
                let targetResource = null;
                for (const mod of curso.modulos || []) {
                    for (const lec of mod.lecciones || []) {
                        for (const rec of lec.recursos || []) {
                            if (rec.guid === resolvedParams.recurso_guid) {
                                targetResource = rec;
                                break;
                            }
                        }
                    }
                }

                if (targetResource) {
                    setBloqueTitulo(targetResource.titulo?.replace('[QUIZ] ', '') || 'Cuestionario');
                    if (targetResource.quiz_config) {
                        try {
                            setQuizConfig(JSON.parse(targetResource.quiz_config));
                        } catch (e) {
                            console.error("Quiz config corrupto", e);
                        }
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchQuizData();
    }, [resolvedParams.curso_id, resolvedParams.recurso_guid, userGuid]);

    // Timer logic
    useEffect(() => {
        if (!started || timeLeft === null) return;
        
        if (timeLeft <= 0) {
            handleSubmit(); // Auto-submit when time is up
            return;
        }

        const timerId = setInterval(() => {
            setTimeLeft(prev => prev !== null ? prev - 1 : null);
        }, 1000);

        return () => clearInterval(timerId);
    }, [started, timeLeft]);

    const handleStart = () => {
        if (quizConfig && quizConfig.tiempo_minutos > 0) {
            setTimeLeft(quizConfig.tiempo_minutos * 60);
        }
        setStarted(true);
    };

    const handleSelectOption = (questionId: string, optionId: string) => {
        setRespuestas(prev => ({ ...prev, [questionId]: optionId }));
    };

    const confirmSubmit = () => {
        setShowConfirmModal(true);
    };

    const handleSubmit = async () => {
        if (!userGuid) return;
        setSubmitting(true);
        setShowConfirmModal(false);
        try {
            const res = await api.post(`/cursos/student/quiz/${resolvedParams.recurso_guid}/submit?usuario_guid=${userGuid}`, {
                respuestas
            });
            setShowResultModal({
                nota: res.data.nota,
                correctas: res.data.correctas,
                total: res.data.total
            });
        } catch (err) {
            console.error(err);
            showAlert.error("Error", "Error al enviar las respuestas. Inténtalo de nuevo.");
        } finally {
            setSubmitting(false);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (loading) {
        return <PageLoader message="Cargando cuestionario..." />;
    }

    if (!quizConfig || !quizStatus) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Cuestionario no configurado</h1>
                <button onClick={() => router.push(`/cursos/${resolvedParams.curso_id}`)} className="px-6 py-2 bg-primary text-white font-bold rounded-xl mt-4">Volver al curso</button>
            </div>
        );
    }

    // CHECK STATUS: ALREADY PASSED
    if (quizStatus.mejor_nota >= 3.0 && !showResultModal) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-background to-emerald-950/20 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-background/60 backdrop-blur-xl border border-emerald-500/30 p-12 rounded-[2.5rem] shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-700">
                    <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <Trophy className="h-12 w-12 text-emerald-500" />
                    </div>
                    <h1 className="text-3xl font-black mb-3 text-foreground">¡Cuestionario Aprobado!</h1>
                    <p className="text-muted-foreground mb-6 text-lg">
                        Ya superaste este módulo con una nota de <strong className="text-emerald-500">{quizStatus.mejor_nota.toFixed(1)}</strong>. No necesitas volver a tomarlo.
                    </p>
                    <button onClick={() => router.push(`/cursos/${resolvedParams.curso_id}`)} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white text-lg font-bold rounded-2xl shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-1">
                        Continuar Curso
                    </button>
                </div>
            </div>
        );
    }

    // CHECK STATUS: FAILED AND NO ATTEMPTS LEFT
    if (quizStatus.intentos_realizados >= quizConfig.intentos_permitidos && !showResultModal) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-background to-red-950/20 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-background/60 backdrop-blur-xl border border-red-500/30 p-12 rounded-[2.5rem] shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-700">
                    <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <XCircle className="h-12 w-12 text-red-500" />
                    </div>
                    <h1 className="text-3xl font-black mb-3 text-foreground">Reprobado</h1>
                    <p className="text-muted-foreground mb-6 text-lg">
                        Has agotado tus <strong>{quizConfig.intentos_permitidos}</strong> intentos permitidos para este cuestionario y no lograste la nota mínima aprobatoria.
                    </p>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8">
                        <p className="text-red-500 font-bold text-sm">Mejor nota obtenida: {quizStatus.mejor_nota.toFixed(1)}</p>
                    </div>
                    <button onClick={() => router.push(`/cursos/${resolvedParams.curso_id}`)} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white text-lg font-bold rounded-2xl shadow-lg shadow-red-500/30 transition-all hover:-translate-y-1">
                        Volver al curso
                    </button>
                </div>
            </div>
        );
    }

    const progressPercentage = quizConfig.preguntas.length > 0 
        ? (Object.keys(respuestas).length / quizConfig.preguntas.length) * 100 
        : 0;

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-32">
            {/* Header Glassmorphism */}
            <header className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl border-b border-border/50 h-16 flex items-center px-4 md:px-8 shadow-sm">
                <button onClick={() => router.push(`/cursos/${resolvedParams.curso_id}`)} className="p-2 hover:bg-muted rounded-full transition-colors mr-4">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase font-black text-primary tracking-widest truncate">{cursoTitulo}</div>
                    <h1 className="font-bold text-sm md:text-base truncate">{bloqueTitulo}</h1>
                </div>
                {started && timeLeft !== null && (
                    <div className={`flex items-center gap-2 px-5 py-2 rounded-2xl font-black text-sm border shadow-sm transition-colors ${timeLeft < 60 ? 'bg-red-500/20 text-red-500 border-red-500/50 animate-pulse' : 'bg-background/50 backdrop-blur-md text-foreground border-border'}`}>
                        <Clock className="h-4 w-4" />
                        {formatTime(timeLeft)}
                    </div>
                )}
            </header>

            {/* Progress Bar */}
            {started && (
                <div className="fixed top-16 left-0 right-0 h-1.5 bg-muted z-40">
                    <div 
                        className="h-full bg-primary transition-all duration-500 ease-out"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
            )}

            <main className="max-w-4xl mx-auto p-4 md:p-8 mt-4 md:mt-8">
                {!started ? (
                    <div className="bg-background/50 backdrop-blur-2xl border border-border/60 rounded-[2.5rem] p-8 md:p-14 text-center shadow-2xl max-w-2xl mx-auto animate-in zoom-in-95 duration-700 relative overflow-hidden">
                        {/* Decorative blobs */}
                        <div className="absolute top-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />
                        
                        <div className="relative z-10">
                            <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                                <CheckCircle className="h-12 w-12 text-primary" />
                            </div>
                            <h2 className="text-3xl font-black mb-4 tracking-tight">{bloqueTitulo}</h2>
                            <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
                                Este cuestionario consta de <strong className="text-foreground">{quizConfig.preguntas.length} preguntas</strong>. 
                                {quizConfig.tiempo_minutos > 0 ? ` Tienes un límite de ${quizConfig.tiempo_minutos} minutos.` : ' No hay límite de tiempo.'}
                            </p>
                            
                            <div className="flex justify-center gap-4 mb-10">
                                <div className="bg-muted/50 px-6 py-3 rounded-2xl border border-border">
                                    <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold block mb-1">Intentos</span>
                                    <span className="font-black text-xl">{quizStatus.intentos_realizados} / {quizConfig.intentos_permitidos}</span>
                                </div>
                                <div className="bg-muted/50 px-6 py-3 rounded-2xl border border-border">
                                    <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold block mb-1">Nota Mínima</span>
                                    <span className="font-black text-xl">3.0</span>
                                </div>
                            </div>

                            <button
                                onClick={handleStart}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xl px-10 py-5 rounded-[1.5rem] font-black shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 w-full md:w-auto"
                            >
                                Comenzar Cuestionario
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        {quizConfig.preguntas.map((q, i) => (
                            <div key={q.id} className="bg-background/80 backdrop-blur-xl border border-border/60 rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary/20 group-hover:bg-primary transition-colors" />
                                
                                <h3 className="font-bold text-xl mb-6 flex gap-4 text-foreground/90 leading-relaxed">
                                    <span className="flex-shrink-0 w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg font-black shadow-inner">{i + 1}</span>
                                    <span className="mt-1.5">{q.enunciado}</span>
                                </h3>
                                <div className="space-y-3 md:pl-14">
                                    {q.opciones.map(opt => {
                                        const isSelected = respuestas[q.id] === opt.id;
                                        return (
                                            <div 
                                                key={opt.id}
                                                onClick={() => handleSelectOption(q.id, opt.id)}
                                                className={`flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5 ${
                                                    isSelected 
                                                        ? 'bg-primary/5 border-primary shadow-md shadow-primary/5' 
                                                        : 'bg-background/50 border-border hover:border-primary/40 hover:bg-muted/50'
                                                }`}
                                            >
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${isSelected ? 'border-primary bg-primary/10' : 'border-muted-foreground/30'}`}>
                                                    <div className={`w-3 h-3 bg-primary rounded-full transition-transform duration-300 ${isSelected ? 'scale-100' : 'scale-0'}`} />
                                                </div>
                                                <span className={`text-base md:text-lg ${isSelected ? 'font-bold text-foreground' : 'text-muted-foreground font-medium'}`}>
                                                    {opt.texto}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        <div className="flex justify-end pt-8 pb-12">
                            <button
                                onClick={confirmSubmit}
                                disabled={submitting}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-5 rounded-2xl font-black shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-3 text-lg"
                            >
                                <Send className="h-5 w-5" />
                                Finalizar y Enviar
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Confirm Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
                    <div className="bg-card border border-border shadow-2xl rounded-[2rem] w-full max-w-md p-8 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-5 mb-8">
                            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 shadow-inner">
                                <AlertTriangle className="h-7 w-7 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="font-black text-2xl">¿Terminar Intento?</h3>
                                <p className="text-sm text-muted-foreground font-medium mt-1">Revisa tu resumen antes de continuar.</p>
                            </div>
                        </div>

                        <div className="bg-muted/50 rounded-2xl p-5 mb-8 space-y-3 text-base">
                            <div className="flex justify-between items-center pb-3 border-b border-border/50">
                                <span className="font-bold text-muted-foreground">Total de preguntas:</span>
                                <span className="font-black">{quizConfig.preguntas.length}</span>
                            </div>
                            <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-500 font-bold">
                                <span>Respondidas:</span>
                                <span>{Object.keys(respuestas).length}</span>
                            </div>
                            <div className="flex justify-between items-center text-amber-600 dark:text-amber-500 font-bold">
                                <span>Sin responder:</span>
                                <span>{quizConfig.preguntas.length - Object.keys(respuestas).length}</span>
                            </div>
                        </div>

                        {quizConfig.preguntas.length - Object.keys(respuestas).length > 0 && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-8">
                                <p className="text-sm text-amber-600 font-bold text-center">
                                    Las preguntas en blanco se evaluarán con 0 puntos.
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-4 px-4 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-2xl transition-all hover:scale-[1.02]"
                            >
                                Volver al examen
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="flex-1 py-4 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-2xl shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                            >
                                {submitting ? 'Enviando...' : 'Confirmar Envío'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Modal */}
            {showResultModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-xl">
                    <div className="bg-card border border-border shadow-2xl rounded-[2.5rem] w-full max-w-sm p-10 text-center animate-in zoom-in-95 duration-500">
                        <div className={`w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner ${
                            showResultModal.nota >= 3.0 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                            {showResultModal.nota >= 3.0 ? <Trophy className="h-14 w-14" /> : <XCircle className="h-14 w-14" />}
                        </div>
                        <h3 className="font-black text-5xl mb-3 text-foreground tracking-tighter">
                            {showResultModal.nota.toFixed(1)} <span className="text-2xl text-muted-foreground font-bold tracking-normal">/ 5.0</span>
                        </h3>
                        <p className={`font-black text-lg mb-8 uppercase tracking-widest ${showResultModal.nota >= 3.0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {showResultModal.nota >= 3.0 ? '¡Aprobado!' : 'Reprobado'}
                        </p>
                        
                        <div className="bg-muted/50 rounded-2xl p-5 mb-10 text-sm flex justify-around border border-border/50">
                            <div className="text-center">
                                <div className="font-black text-2xl text-foreground">{showResultModal.correctas}</div>
                                <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-1">Aciertos</div>
                            </div>
                            <div className="w-px bg-border"></div>
                            <div className="text-center">
                                <div className="font-black text-2xl text-foreground">{showResultModal.total - showResultModal.correctas}</div>
                                <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-1">Fallos</div>
                            </div>
                        </div>

                        <button
                            onClick={() => router.push(`/cursos/${resolvedParams.curso_id}`)}
                            className="w-full py-5 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-lg rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                        >
                            Finalizar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
