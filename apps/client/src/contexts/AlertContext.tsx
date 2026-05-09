"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle, X } from 'lucide-react';

type AlertType = 'success' | 'error' | 'warning' | 'info';
type ConfirmVariant = 'danger' | 'warning' | 'info';

interface AlertState {
  open: boolean;
  type: AlertType;
  title: string;
  message: string;
  autoClose: number | false; // ms to auto-close, false to disable
}

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  variant: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

interface AlertContextType {
  showAlert: {
    success: (title: string, message?: string, autoClose?: number | false) => void;
    error: (title: string, message?: string, autoClose?: number | false) => void;
    warning: (title: string, message?: string, autoClose?: number | false) => void;
    info: (title: string, message?: string, autoClose?: number | false) => void;
  };
  showConfirm: (title: string, message: string, confirmText?: string, variant?: ConfirmVariant) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

// Default auto-close times per type (ms)
const AUTO_CLOSE_DEFAULTS: Record<AlertType, number | false> = {
  success: 3000,
  error: false, // errors stay until dismissed
  warning: 5000,
  info: 4000,
};

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<AlertState>({ open: false, type: 'info', title: '', message: '', autoClose: false });
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, title: '', message: '', confirmText: 'Confirmar', variant: 'danger', onConfirm: () => {}, onCancel: () => {} });
  const [closing, setClosing] = useState(false);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-close logic
  useEffect(() => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    if (alert.open && alert.autoClose && alert.autoClose > 0) {
      autoCloseTimerRef.current = setTimeout(() => {
        closeAlert();
      }, alert.autoClose);
    }
    return () => { if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current); };
  }, [alert.open, alert.autoClose]);

  const closeAlert = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setAlert(prev => ({ ...prev, open: false }));
      setClosing(false);
    }, 150);
  }, []);

  const displayAlert = useCallback((type: AlertType, title: string, message?: string, autoClose?: number | false) => {
    const resolvedAutoClose = autoClose !== undefined ? autoClose : AUTO_CLOSE_DEFAULTS[type];
    setClosing(false);
    setAlert({ open: true, type, title, message: message || '', autoClose: resolvedAutoClose });
  }, []);

  const showAlertObj = {
    success: useCallback((title: string, message?: string, autoClose?: number | false) => displayAlert('success', title, message, autoClose), [displayAlert]),
    error: useCallback((title: string, message?: string, autoClose?: number | false) => displayAlert('error', title, message, autoClose), [displayAlert]),
    warning: useCallback((title: string, message?: string, autoClose?: number | false) => displayAlert('warning', title, message, autoClose), [displayAlert]),
    info: useCallback((title: string, message?: string, autoClose?: number | false) => displayAlert('info', title, message, autoClose), [displayAlert]),
  };

  const showConfirm = useCallback((title: string, message: string, confirmText = 'Confirmar', variant: ConfirmVariant = 'danger'): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirm({
        open: true,
        title,
        message,
        confirmText,
        variant,
        onConfirm: () => {
          setConfirm(prev => ({ ...prev, open: false }));
          resolve(true);
        },
        onCancel: () => {
          setConfirm(prev => ({ ...prev, open: false }));
          resolve(false);
        }
      });
    });
  }, []);

  const getAlertIcon = (type: AlertType) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-8 w-8 text-emerald-500" />;
      case 'error': return <XCircle className="h-8 w-8 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-8 w-8 text-amber-500" />;
      case 'info': return <Info className="h-8 w-8 text-blue-500" />;
    }
  };

  const getAlertColorClass = (type: AlertType) => {
    switch (type) {
      case 'success': return 'bg-emerald-500/15 text-emerald-500';
      case 'error': return 'bg-red-500/15 text-red-500';
      case 'warning': return 'bg-amber-500/15 text-amber-500';
      case 'info': return 'bg-blue-500/15 text-blue-500';
    }
  };

  const getAlertButtonClass = (type: AlertType) => {
    switch (type) {
      case 'success': return 'bg-emerald-500 hover:bg-emerald-600';
      case 'error': return 'bg-red-500 hover:bg-red-600';
      case 'warning': return 'bg-amber-500 hover:bg-amber-600';
      case 'info': return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  const getConfirmColors = (variant: ConfirmVariant) => {
    switch (variant) {
      case 'danger': return { bg: 'bg-red-500/15', icon: 'text-red-500', btn: 'bg-red-500 hover:bg-red-600' };
      case 'warning': return { bg: 'bg-amber-500/15', icon: 'text-amber-500', btn: 'bg-amber-500 hover:bg-amber-600' };
      case 'info': return { bg: 'bg-blue-500/15', icon: 'text-blue-500', btn: 'bg-blue-500 hover:bg-blue-600' };
    }
  };

  const confirmColors = getConfirmColors(confirm.variant);

  return (
    <AlertContext.Provider value={{ showAlert: showAlertObj, showConfirm }}>
      {children}
      
      {/* Alert Modal */}
      {alert.open && (
        <div 
          className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-opacity duration-150 ${closing ? 'opacity-0' : 'opacity-100 animate-in fade-in duration-200'}`}
          onClick={(e) => { if (e.target === e.currentTarget) closeAlert(); }}
        >
          <div role="alertdialog" aria-live="assertive" aria-label={alert.title} className={`bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-all duration-150 ${closing ? 'scale-95 opacity-0' : 'animate-in zoom-in-95 duration-200'}`}>
            {/* Close button */}
            <button
              type="button"
              onClick={closeAlert}
              className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="p-6 flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${getAlertColorClass(alert.type).split(' ')[0]}`}>
                {getAlertIcon(alert.type)}
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{alert.title}</h3>
              {alert.message && (
                  <p className="text-muted-foreground text-sm leading-relaxed">{alert.message}</p>
              )}
            </div>
            {/* Progress bar for auto-close */}
            {alert.autoClose && alert.autoClose > 0 && (
              <div className="px-6 -mt-2 mb-2">
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${getAlertButtonClass(alert.type)?.split(' ')[0]}`}
                    style={{ animation: `shrink ${alert.autoClose}ms linear forwards` }}
                  />
                </div>
              </div>
            )}
            <div className="px-6 pb-6 flex justify-center">
              <button 
                type="button"
                onClick={closeAlert}
                className={`w-full text-white font-bold py-3 rounded-xl transition-colors shadow-md ${getAlertButtonClass(alert.type)}`}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirm.open && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) confirm.onCancel(); }}
        >
          <div role="alertdialog" aria-live="assertive" aria-label={confirm.title} className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center">
              <div className={`w-16 h-16 ${confirmColors.bg} rounded-full flex items-center justify-center mb-4`}>
                <AlertTriangle className={`h-8 w-8 ${confirmColors.icon}`} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{confirm.title}</h3>
              {confirm.message && (
                  <p className="text-muted-foreground text-sm leading-relaxed">{confirm.message}</p>
              )}
            </div>
            <div className="px-6 pb-6 flex items-center gap-3">
              <button 
                type="button"
                onClick={confirm.onCancel}
                className="flex-1 bg-muted hover:bg-border text-foreground font-bold py-3 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={confirm.onConfirm}
                className={`flex-1 ${confirmColors.btn} text-white font-bold py-3 rounded-xl transition-colors shadow-md`}
              >
                {confirm.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for auto-close progress bar animation */}
      <style jsx global>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
