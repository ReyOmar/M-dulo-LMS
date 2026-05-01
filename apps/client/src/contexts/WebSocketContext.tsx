"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';

type WebSocketEvent = 
  | 'session:revoked'
  | 'user:deleted'
  | 'user:created'
  | 'request:new'
  | 'request:resolved'
  | 'course:updated'
  | 'course:created'
  | 'course:deleted'
  | 'enrollment:changed'
  | 'submission:new'
  | 'submission:graded'
  | 'config:updated'
  | 'presence:update'
  | 'dashboard:refresh';

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (event: WebSocketEvent, callback: (data: any) => void) => () => void;
  onlineUsers: string[];
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  subscribe: () => () => {},
  onlineUsers: [],
});

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<WebSocketEvent, Set<(data: any) => void>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const connect = useCallback(() => {
    // Only connect if we have a token
    const token = localStorage.getItem('lms_token');
    if (!token) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Use environment variable for API URL or default
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3200/api';
    const wsUrl = apiBaseUrl.replace(/^http/, 'ws').replace('/api', '') + '/ws?token=' + token;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      retryCountRef.current = 0; // reset backoff
      console.log('✅ LMS WebSocket conectado');
    };

    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        const { event, data } = payload as { event: WebSocketEvent; data: any };

        // Handle system-level events automatically
        if (event === 'session:revoked') {
          console.warn('⚠️ Sesión revocada por el servidor:', data?.reason);
          localStorage.removeItem('lms_token');
          localStorage.removeItem('lms_user');
          window.location.href = '/login?revoked=true';
          return;
        }

        if (event === 'presence:update') {
          if (data?.onlineUsers) {
            setOnlineUsers(data.onlineUsers);
          }
        }

        // Notify all registered listeners for this event
        const listeners = listenersRef.current.get(event);
        if (listeners) {
          listeners.forEach(cb => cb(data));
        }

        // Dashboard refresh can be generic or mapped to specific events
        if (event === 'dashboard:refresh') {
          const refreshListeners = listenersRef.current.get('dashboard:refresh');
          if (refreshListeners) {
            refreshListeners.forEach(cb => cb(data));
          }
        }
      } catch (err) {
        console.error('Error parseando mensaje WS:', err);
      }
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      wsRef.current = null;
      
      // If code is 4004 (session revoked), do not reconnect
      if (event.code === 4004) return;
      
      // If token is missing, do not reconnect
      if (!localStorage.getItem('lms_token')) return;

      // Exponential backoff for reconnection
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
      retryCountRef.current += 1;
      
      console.log(`🔌 WS Desconectado. Reconectando en ${delay/1000}s...`);
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // Error will trigger onclose which handles reconnection
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    // Initial connection attempt
    connect();

    // Listen for storage changes to connect/disconnect when login state changes across tabs
    const handleStorageChange = () => {
      if (!localStorage.getItem('lms_token')) {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      } else if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connect();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Check periodically if we have a token but no connection
    const connectionCheck = setInterval(() => {
      if (localStorage.getItem('lms_token') && !wsRef.current) {
        connect();
      }
    }, 10000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(connectionCheck);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        // Use a generic close code for cleanup
        wsRef.current.close(1000, 'Unmounting provider');
      }
    };
  }, [connect]);

  const subscribe = useCallback((event: WebSocketEvent, callback: (data: any) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    
    const listeners = listenersRef.current.get(event)!;
    listeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      const currentListeners = listenersRef.current.get(event);
      if (currentListeners) {
        currentListeners.delete(callback);
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe, onlineUsers }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWS() {
  return useContext(WebSocketContext);
}
