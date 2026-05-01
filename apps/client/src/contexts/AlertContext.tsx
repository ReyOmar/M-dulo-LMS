"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertState {
  open: boolean;
  type: AlertType;
  title: string;
  message: string;
}

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface AlertContextType {
  showAlert: {
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
  };
  showConfirm: (title: string, message: string, confirmText?: string) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<AlertState>({ open: false, type: 'info', title: '', message: '' });
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, title: '', message: '', confirmText: 'Confirmar', onConfirm: () => {}, onCancel: () => {} });

  const displayAlert = useCallback((type: AlertType, title: string, message?: string) => {
    setAlert({ open: true, type, title, message: message || '' });
  }, []);

  const showAlertObj = {
    success: useCallback((title: string, message?: string) => displayAlert('success', title, message), [displayAlert]),
    error: useCallback((title: string, message?: string) => displayAlert('error', title, message), [displayAlert]),
    warning: useCallback((title: string, message?: string) => displayAlert('warning', title, message), [displayAlert]),
    info: useCallback((title: string, message?: string) => displayAlert('info', title, message), [displayAlert]),
  };

  const showConfirm = useCallback((title: string, message: string, confirmText = 'Confirmar'): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirm({
        open: true,
        title,
        message,
        confirmText,
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

  return (
    <AlertContext.Provider value={{ showAlert: showAlertObj, showConfirm }}>
      {children}
      
      {/* Alert Modal */}
      {alert.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${getAlertColorClass(alert.type).split(' ')[0]}`}>
                {getAlertIcon(alert.type)}
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{alert.title}</h3>
              {alert.message && (
                  <p className="text-muted-foreground text-sm leading-relaxed">{alert.message}</p>
              )}
            </div>
            <div className="px-6 pb-6 flex justify-center">
              <button 
                type="button"
                onClick={() => setAlert(prev => ({ ...prev, open: false }))}
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-500/15 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-red-500" />
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
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors shadow-md"
              >
                {confirm.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
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
