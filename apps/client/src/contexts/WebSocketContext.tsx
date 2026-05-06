"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';

type WebSocketEvent = 
  | 'session:revoked'
  | 'user:deleted'
  | 'user:created'
  | 'user:updated'
  | 'request:new'
  | 'request:resolved'
  | 'course:updated'
  | 'course:created'
  | 'course:deleted'
  | 'course:editing'
  | 'course:editing-released'
  | 'course:editing-sync'
  | 'course:maintenance'
  | 'enrollment:changed'
  | 'submission:new'
  | 'submission:graded'
  | 'config:updated'
  | 'presence:update'
  | 'dashboard:refresh'
  | 'notification:new'
  | 'notification:read'
  | 'message:new'
  | 'certificate:new';

interface CourseEditor {
  guid: string;
  role: string;
  nombre: string;
}

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (event: WebSocketEvent, callback: (data: any) => void) => () => void;
  send: (action: string, data: any) => void;
  onlineUsers: string[];
  editingCourses: Record<string, CourseEditor>;
  maintenanceCourses: Record<string, string>;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  subscribe: () => () => {},
  send: () => {},
  onlineUsers: [],
  editingCourses: {},
  maintenanceCourses: {},
});

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [editingCourses, setEditingCourses] = useState<Record<string, CourseEditor>>({});
  const [maintenanceCourses, setMaintenanceCourses] = useState<Record<string, string>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<WebSocketEvent, Set<(data: any) => void>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Use environment variable for API URL or default
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3200/api';
    const token = localStorage.getItem('lms_token');
    
    let wsUrl = apiBaseUrl.replace(/^http/, 'ws').replace('/api', '') + '/ws';
    if (token) {
      wsUrl += '?token=' + token;
    }

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

        // Handle course editing lock events internally
        if (event === 'course:editing') {
          setEditingCourses(prev => ({ ...prev, [data.curso_guid]: data.editor }));
        }
        if (event === 'course:editing-released') {
          setEditingCourses(prev => {
            const next = { ...prev };
            delete next[data.curso_guid];
            return next;
          });
        }
        if (event === 'course:editing-sync') {
          // Full sync of all currently editing courses (received on connect)
          setEditingCourses(data || {});
        }

        // Handle course maintenance events
        if (event === 'course:maintenance') {
          setMaintenanceCourses(prev => ({ ...prev, [data.curso_guid]: data.titulo }));
        }
        // Clear maintenance when course is republished
        if (event === 'course:updated' && data.estado === 'PUBLICADO') {
          setMaintenanceCourses(prev => {
            const next = { ...prev };
            delete next[data.guid];
            return next;
          });
        }

        // Notify all registered listeners for this event (debounced to prevent API bursts)
        const notifyListeners = (targetEvent: WebSocketEvent, eventData: any) => {
          const listeners = listenersRef.current.get(targetEvent);
          if (!listeners || listeners.size === 0) return;

          // Clear any existing debounce timer for this event
          const existingTimer = debounceTimersRef.current.get(targetEvent);
          if (existingTimer) clearTimeout(existingTimer);

          // Debounce: wait 300ms before firing to coalesce rapid events
          const timer = setTimeout(() => {
            debounceTimersRef.current.delete(targetEvent);
            const currentListeners = listenersRef.current.get(targetEvent);
            if (currentListeners) {
              currentListeners.forEach(cb => cb(eventData));
            }
          }, 300);
          debounceTimersRef.current.set(targetEvent, timer);
        };

        notifyListeners(event, data);
      } catch (err) {
        console.error('Error parseando mensaje WS:', err);
      }
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      setOnlineUsers([]); // Clear stale presence data
      wsRef.current = null;
      
      // If code is 4004 (session revoked), do not reconnect automatically as guest immediately,
      // wait until login redirect happens to avoid loop.
      if (event.code === 4004) return;

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

    // Listen for storage changes to reconnect with token if login state changes across tabs
    const handleStorageChange = () => {
      if (wsRef.current) {
        // Close and reconnect to upgrade/downgrade session
        wsRef.current.close(1000, 'Auth changed');
      } else {
        connect();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Check periodically to ensure connection
    const connectionCheck = setInterval(() => {
      if (!wsRef.current) {
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

  const send = useCallback((action: string, data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, ...data }));
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe, send, onlineUsers, editingCourses, maintenanceCourses }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWS() {
  return useContext(WebSocketContext);
}
