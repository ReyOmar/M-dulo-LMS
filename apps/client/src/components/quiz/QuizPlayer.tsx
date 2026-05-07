"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, Clock, AlertTriangle, Send, Trophy, XCircle, ExternalLink, Paperclip, LogOut } from "lucide-react";
import api, { API_BASE_URL } from "@/lib/api";
import { useAlert } from "@/contexts/AlertContext";
import { sanitizeHTML } from "@/lib/sanitize";

interface QuizOption { id: string; texto: string; }
interface QuizQuestion { id: string; enunciado: string; opciones: QuizOption[]; }
interface QuizConfig { intentos_permitidos: number; tiempo_minutos: number; preguntas: QuizQuestion[]; }

interface QuizStatus {
    intentos_realizados: number;
    mejor_nota: number;
    completado: boolean;
    in_progress?: boolean;
    fecha_inicio?: string;
    puede_reintentar?: boolean;
}

interface QuizPlayerProps {
    curso_id: string;
    recurso_guid: string;
    bloque_titulo: string;
    quiz_config_raw: string;
    instrucciones_html?: string;
    url_referencia?: string;
    archivo_adjunto?: string;
    archivo_adjunto_nombre?: string;
    onFinish: (success?: boolean) => void;
    onQuizStateChange?: (isActive: boolean) => void;
}

export default function QuizPlayer({ 
    curso_id, 
    recurso_guid, 
    bloque_titulo, 
    quiz_config_raw, 
    instrucciones_html,
    url_referencia,
    archivo_adjunto,
    archivo_adjunto_nombre,
    onFinish,
    onQuizStateChange
}: QuizPlayerProps) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);
    const [userGuid, setUserGuid] = useState<string>('');
    const [quizStatus, setQuizStatus] = useState<QuizStatus | null>(null);
    
    const [respuestas, setRespuestas] = useState<Record<string, string>>({});
    const [started, setStarted] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    
    // Modals
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showResultModal, setShowResultModal] = useState<{nota: number, correctas: number, total: number} | null>(null);
    const { showAlert } = useAlert();

    useEffect(() => {
        const savedUser = localStorage.getItem("lms_user");
        if (savedUser) {
            try { setUserGuid(JSON.parse(savedUser).guid); } catch {}
        }
    }, []);

    // localStorage key for persisting quiz answers
    const storageKey = `quiz_answers_${recurso_guid}_${userGuid}`;

    // Persist answers to localStorage whenever they change
    useEffect(() => {
        if (started && userGuid && Object.keys(respuestas).length > 0) {
            try { localStorage.setItem(storageKey, JSON.stringify(respuestas)); } catch {}
        }
    }, [respuestas, started, userGuid, storageKey]);

    const fetchStatus = useCallback(async () => {
        if (!userGuid) return;
        try {
            let configParsed: QuizConfig | null = null;
            if (quiz_config_raw) {
                try {
                    configParsed = JSON.parse(quiz_config_raw);
                    setQuizConfig(configParsed);
                } catch (e) {
                    console.error("Quiz config corrupto", e);
                }
            }

            const resStatus = await api.get(`/cursos/student/quiz/${recurso_guid}/status?usuario_guid=${userGuid}`);
            const status: QuizStatus = resStatus.data;
            setQuizStatus(status);

            // AUTO-RESUME if in progress
            if (status.in_progress && status.fecha_inicio && configParsed) {
                setStarted(true);
                if (onQuizStateChange) onQuizStateChange(true);
                
                // Restore saved answers from localStorage
                const savedKey = `quiz_answers_${recurso_guid}_${userGuid}`;
                try {
                    const savedAnswers = localStorage.getItem(savedKey);
                    if (savedAnswers) {
                        const parsed = JSON.parse(savedAnswers);
                        if (parsed && typeof parsed === 'object') {
                            setRespuestas(parsed);
                        }
                    }
                } catch {}
                
                const startTime = new Date(status.fecha_inicio).getTime();
                const now = new Date().getTime();
                const elapsedSeconds = Math.floor((now - startTime) / 1000);
                
                if (configParsed.tiempo_minutos > 0) {
                    const totalTime = configParsed.tiempo_minutos * 60;
                    const remaining = totalTime - elapsedSeconds;
                    if (remaining <= 0) {
                        setTimeLeft(0);
                    } else {
                        setTimeLeft(remaining);
                    }
                }
            }

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [recurso_guid, userGuid, quiz_config_raw, onQuizStateChange]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

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

    const handleStart = async () => {
        if (!userGuid || isStarting) return;
        setIsStarting(true);
        try {
            await api.post(`/cursos/student/quiz/${recurso_guid}/start?usuario_guid=${userGuid}`);
            if (quizConfig && quizConfig.tiempo_minutos > 0) {
                setTimeLeft(quizConfig.tiempo_minutos * 60);
            }
            setStarted(true);
            if (onQuizStateChange) onQuizStateChange(true);
        } catch (err) {
            console.error(err);
            showAlert.error("Error", "No se pudo iniciar el intento. Intenta de nuevo.");
        } finally {
            setIsStarting(false);
        }
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
            const res = await api.post(`/cursos/student/quiz/${recurso_guid}/submit?usuario_guid=${userGuid}`, {
                respuestas
            });
            // Clear saved answers from localStorage on successful submit
            try { localStorage.removeItem(storageKey); } catch {}
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

    const resetQuiz = async () => {
        if (isStarting) return;
        
        const success = showResultModal ? showResultModal.nota >= 3.0 : (quizStatus?.mejor_nota ? quizStatus.mejor_nota >= 3.0 : false);
        
        // Bloqueamos la interfaz desde ya para evitar clics dobles mientras se redirige
        setIsStarting(true);
        
        setStarted(false);
        setTimeLeft(null);
        setRespuestas({});
        setShowResultModal(null);
        setSubmitting(false);
        setLoading(true);
        // Clear saved answers from localStorage
        try { localStorage.removeItem(storageKey); } catch {}
        if (onQuizStateChange) onQuizStateChange(false);
        
        await fetchStatus();
        
        // Si tuvo éxito, se queda en la pantalla actual de completado, así que desbloqueamos.
        // Si falló, lo mantenemos bloqueado porque el padre lo va a redireccionar y desmontar.
        if (success) {
            setIsStarting(false);
        }
        
        onFinish(success); // Callback to refresh course progress and redirect if failed
    };

    if (loading) {
        return (
            <div className="bg-card border border-border/50 rounded-[2.5rem] p-12 flex flex-col items-center justify-center min-h-[350px] shadow-sm animate-pulse">
                <div className="w-20 h-20 bg-muted/60 rounded-full mb-6" />
                <div className="h-8 w-64 bg-muted/60 rounded-2xl mb-4" />
                <div className="h-4 w-48 bg-muted/60 rounded-xl" />
            </div>
        );
    }

    if (!quizConfig || !quizStatus) {
        return (
            <div className="flex flex-col items-center justify-center p-6 text-center border border-border/50 rounded-3xl bg-card">
                <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Cuestionario no configurado</h1>
            </div>
        );
    }

    // CHECK STATUS: ALREADY PASSED
    if (quizStatus.mejor_nota >= 3.0 && !showResultModal && !started) {
        return (
            <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-950/20 flex flex-col items-center justify-center p-12 text-center border border-emerald-500/30 rounded-[2rem] shadow-sm animate-in fade-in duration-500">
                <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <Trophy className="h-12 w-12 text-emerald-500" />
                </div>
                <h1 className="text-3xl font-black mb-3 text-foreground tracking-tight">¡Cuestionario Aprobado!</h1>
                <p className="text-muted-foreground mb-8 text-lg max-w-sm">
                    Ya superaste este módulo con una nota de <strong className="text-emerald-500">{quizStatus.mejor_nota.toFixed(1)}</strong>.
                </p>
                <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-2 rounded-full text-emerald-600 font-bold text-sm">
                    Módulo Completado
                </div>
            </div>
        );
    }

    const progressPercentage = quizConfig.preguntas.length > 0 
        ? (Object.keys(respuestas).length / quizConfig.preguntas.length) * 100 
        : 0;

    return (
        <div className="bg-card border border-border/50 rounded-[2.5rem] overflow-hidden shadow-sm relative transition-all duration-500">
            {/* Header Mini (Solo si empezó) */}
            {started && (
                <div className="bg-background/80 backdrop-blur-md border-b border-border/50 p-4 flex items-center justify-between sticky top-0 z-30 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-4">
                         <button 
                            onClick={() => setShowCancelModal(true)}
                            className="p-2 hover:bg-red-500/10 text-red-500 rounded-full transition-colors"
                            title="Salir del cuestionario"
                         >
                            <LogOut className="h-5 w-5" />
                         </button>
                         <div className="font-bold text-sm truncate max-w-[150px] md:max-w-none">{bloque_titulo}</div>
                    </div>
                    <div className="flex items-center gap-4">
                        {timeLeft !== null && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-black text-xs border transition-colors ${timeLeft < 60 ? 'bg-red-500/20 text-red-500 border-red-500/50 animate-pulse' : 'bg-muted text-foreground border-border'}`}>
                                <Clock className="h-3 w-3" />
                                {formatTime(timeLeft)}
                            </div>
                        )}
                        <div className="text-xs font-bold text-muted-foreground hidden sm:block">
                            {Object.keys(respuestas).length} / {quizConfig.preguntas.length}
                        </div>
                    </div>
                    {/* Progress Bar inside header */}
                    <div className="absolute bottom-0 left-0 h-1 bg-primary transition-all duration-500 ease-out" style={{ width: `${progressPercentage}%` }} />
                </div>
            )}

            {!started ? (
                <div className="animate-in fade-in duration-500">
                    {/* INSTRUCCIONES (Solo antes de empezar) */}
                    <div className="p-6 md:p-10 border-b border-border bg-amber-500/10">
                        <h3 className="font-bold text-xs text-amber-700 dark:text-amber-500 uppercase tracking-widest mb-4">Instrucciones del Cuestionario</h3>
                        <div className="prose prose-slate dark:prose-invert max-w-none text-foreground" dangerouslySetInnerHTML={sanitizeHTML(instrucciones_html || '<p class="text-muted-foreground italic opacity-70">Sin instrucciones específicas.</p>')} />
                        
                        {(url_referencia || archivo_adjunto) && (
                            <div className="mt-8 space-y-3">
                                {url_referencia && (
                                    <a href={(() => { const u = url_referencia || ''; return /^https?:\/\//i.test(u) || u.startsWith('//') ? u : `https://${u}`; })()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-background/50 border border-primary/20 rounded-2xl text-sm text-primary font-bold hover:bg-primary/5 transition-all group">
                                        <ExternalLink className="h-5 w-5 group-hover:scale-110 transition-transform" /> 
                                        <span className="truncate">{url_referencia}</span>
                                    </a>
                                )}
                                {archivo_adjunto && (
                                    <a href={`${API_BASE_URL}/cursos/download/${archivo_adjunto}?originalName=${encodeURIComponent(archivo_adjunto_nombre || 'archivo')}`} className="flex items-center gap-4 p-4 bg-background/50 border border-border rounded-2xl hover:bg-primary/5 hover:border-primary/20 transition-all group">
                                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                            <Paperclip className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-black text-foreground block truncate">{archivo_adjunto_nombre || 'Descargar archivo adjunto'}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Recurso de apoyo</span>
                                        </div>
                                    </a>
                                )}
                            </div>
                        )}
                    </div>

                    {/* INTRO SCREEN */}
                    <div className="p-10 text-center relative overflow-hidden">
                        {/* Decorative blobs */}
                        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                        <div className="absolute bottom-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl translate-x-1/2 translate-y-1/2 pointer-events-none" />
                        
                        <div className="relative z-10 py-4">
                            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                <CheckCircle className="h-10 w-10 text-amber-500" />
                            </div>
                            
                            <h2 className="text-2xl font-black mb-6 tracking-tight text-foreground uppercase tracking-widest">Información de Evaluación</h2>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto mb-12">
                                <div className="bg-muted/30 p-5 rounded-[1.5rem] border border-border flex flex-col items-center transition-transform hover:scale-105">
                                    <Clock className="h-6 w-6 text-amber-500 mb-2" />
                                    <span className="text-xl font-black">{quizConfig.tiempo_minutos} min</span>
                                    <span className="text-[10px] text-muted-foreground uppercase font-black">Tiempo límite</span>
                                </div>
                                <div className="bg-muted/30 p-5 rounded-[1.5rem] border border-border flex flex-col items-center transition-transform hover:scale-105">
                                    <Send className="h-6 w-6 text-blue-500 mb-2" />
                                    <span className="text-xl font-black">{quizConfig.preguntas.length} pregunta(s)</span>
                                    <span className="text-[10px] text-muted-foreground uppercase font-black">Evaluación</span>
                                </div>
                                <div className="bg-muted/30 p-5 rounded-[1.5rem] border border-border flex flex-col items-center transition-transform hover:scale-105">
                                    <Trophy className="h-6 w-6 text-emerald-500 mb-2" />
                                    <span className="text-xl font-black">{quizStatus.intentos_realizados}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase font-black">Intento(s) previos</span>
                                </div>
                            </div>

                            <p className="text-muted-foreground mb-10 text-sm max-w-md mx-auto italic font-medium">
                                Al presionar el botón inferior, comenzarás tu intento. El tiempo empezará a correr inmediatamente.
                            </p>

                            <button
                                onClick={handleStart}
                                disabled={isStarting}
                                className={`text-xl px-16 py-5 rounded-[1.5rem] font-black transition-all w-full sm:w-auto inline-flex items-center justify-center gap-3 mx-auto ${
                                    isStarting 
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed border border-border opacity-70' 
                                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-2xl shadow-amber-500/30 hover:scale-105 active:scale-95'
                                }`}
                            >
                                {isStarting && <span className="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"></span>}
                                {isStarting ? 'Cargando...' : 'Comenzar Intento'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* QUIZ ACTIVE SCREEN */
                <div className="p-6 md:p-12 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    {quizConfig.preguntas.map((q, i) => (
                        <div key={q.id} className="bg-background border border-border/60 rounded-[2rem] p-6 md:p-10 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary/20 group-hover:bg-primary transition-colors" />
                            
                            <h3 className="font-bold text-xl md:text-2xl mb-8 flex gap-5 text-foreground leading-relaxed">
                                <span className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg md:text-xl font-black shadow-inner">{i + 1}</span>
                                <span className="mt-2">{q.enunciado}</span>
                            </h3>
                            <div className="space-y-3 md:pl-16">
                                {q.opciones.map(opt => {
                                    const isSelected = respuestas[q.id] === opt.id;
                                    return (
                                        <div 
                                            key={opt.id}
                                            onClick={() => handleSelectOption(q.id, opt.id)}
                                            className={`flex items-center gap-4 md:gap-5 p-5 md:p-6 rounded-[1.5rem] border-2 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 ${
                                                isSelected 
                                                    ? 'bg-primary/5 border-primary shadow-lg shadow-primary/5' 
                                                    : 'bg-background border-border hover:border-primary/30 hover:bg-muted/50'
                                            }`}
                                        >
                                            <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${isSelected ? 'border-primary bg-primary/10' : 'border-muted-foreground/30'}`}>
                                                <div className={`w-3 h-3 md:w-3.5 md:h-3.5 bg-primary rounded-full transition-transform duration-300 ${isSelected ? 'scale-100' : 'scale-0'}`} />
                                            </div>
                                            <span className={`text-base md:text-lg ${isSelected ? 'font-black text-foreground' : 'text-muted-foreground font-semibold'}`}>
                                                {opt.texto}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    <div className="flex justify-center pt-10 pb-10">
                        <button
                            onClick={confirmSubmit}
                            disabled={submitting}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-12 py-5 rounded-[1.5rem] font-black shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-4 text-xl"
                        >
                            {submitting ? (
                                <span className="flex items-center gap-2">Enviando...</span>
                            ) : (
                                <>
                                    <Send className="h-6 w-6" />
                                    Finalizar y Enviar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-card border border-border shadow-2xl rounded-[2.5rem] w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-5 mb-8">
                            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 shadow-inner">
                                <AlertTriangle className="h-7 w-7 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="font-black text-2xl tracking-tight">¿Terminar Intento?</h3>
                                <p className="text-sm text-muted-foreground font-bold mt-1">Revisa tu resumen antes de enviar.</p>
                            </div>
                        </div>

                        <div className="bg-muted/50 rounded-[1.5rem] p-6 mb-8 space-y-3 text-base border border-border/50">
                            <div className="flex justify-between items-center pb-3 border-b border-border/50">
                                <span className="font-bold text-muted-foreground">Total de preguntas:</span>
                                <span className="font-black">{quizConfig.preguntas.length}</span>
                            </div>
                            <div className="flex justify-between items-center text-emerald-600 font-black">
                                <span>Respondidas:</span>
                                <span>{Object.keys(respuestas).length}</span>
                            </div>
                            <div className="flex justify-between items-center text-amber-600 font-black">
                                <span>Sin responder:</span>
                                <span>{quizConfig.preguntas.length - Object.keys(respuestas).length}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-4 bg-muted hover:bg-muted/80 text-foreground font-black rounded-2xl transition-all"
                            >
                                Volver
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="flex-[2] py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                                {submitting ? 'Enviando...' : 'Confirmar Envío'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-card border border-border shadow-2xl rounded-[2.5rem] w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-5 mb-8">
                            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 shadow-inner">
                                <XCircle className="h-7 w-7 text-red-500" />
                            </div>
                            <div>
                                <h3 className="font-black text-2xl tracking-tight">¿Abandonar Intento?</h3>
                                <p className="text-sm text-muted-foreground font-bold mt-1">Perderás tu progreso actual y se contará como un intento.</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCancelModal(false)}
                                className="flex-1 py-4 bg-muted hover:bg-muted/80 text-foreground font-black rounded-2xl transition-all"
                            >
                                No, continuar
                            </button>
                            <button
                                onClick={() => {
                                    setShowCancelModal(false);
                                    resetQuiz();
                                }}
                                className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl shadow-lg transition-all"
                            >
                                Sí, salir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Modal */}
            {showResultModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-xl animate-in fade-in duration-500">
                    <div className="bg-card border border-border shadow-2xl rounded-[3rem] w-full max-w-sm p-10 text-center animate-in zoom-in-95 duration-500">
                        <div className={`w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner ${
                            showResultModal.nota >= 3.0 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                            {showResultModal.nota >= 3.0 ? <Trophy className="h-14 w-14" /> : <XCircle className="h-14 w-14" />}
                        </div>
                        <h3 className="font-black text-6xl mb-4 text-foreground tracking-tighter">
                            {showResultModal.nota.toFixed(1)} <span className="text-2xl text-muted-foreground font-bold tracking-normal">/ 5.0</span>
                        </h3>
                        <p className={`font-black text-xl mb-10 uppercase tracking-widest ${showResultModal.nota >= 3.0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {showResultModal.nota >= 3.0 ? '¡Aprobado!' : 'Reprobado'}
                        </p>
                        
                        <div className="bg-muted/50 rounded-[2rem] p-6 mb-10 text-sm flex justify-around border border-border/50">
                            <div className="text-center">
                                <div className="font-black text-3xl text-foreground">{showResultModal.correctas}</div>
                                <div className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mt-1">Aciertos</div>
                            </div>
                            <div className="w-px bg-border/50"></div>
                            <div className="text-center">
                                <div className="font-black text-3xl text-foreground">{showResultModal.total - showResultModal.correctas}</div>
                                <div className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mt-1">Fallos</div>
                            </div>
                        </div>

                        <button
                            onClick={resetQuiz}
                            disabled={isStarting}
                            className={`w-full py-5 font-black text-xl rounded-2xl shadow-2xl transition-all flex items-center justify-center gap-3 ${
                                isStarting 
                                ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-70 border border-border' 
                                : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/30 hover:scale-105 active:scale-95'
                            }`}
                        >
                            {isStarting && <span className="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"></span>}
                            {isStarting ? 'Procesando...' : 'Finalizar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
