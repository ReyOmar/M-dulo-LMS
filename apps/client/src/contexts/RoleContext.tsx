'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/ui/PageLoader';
import { getEnv } from '@/lib/env';

export type Role = 'admin' | 'teacher' | 'student';

interface RoleContextType {
  role: Role;
  user: any;
  isHydrated: boolean;
  logout: () => void;
  syncSession: (tokenStr: string, userData: any) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>('student');
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  const mapDbRole = (dbRole: string): Role => {
    if (dbRole === 'ADMINISTRADOR') return 'admin';
    if (dbRole === 'PROFESOR') return 'teacher';
    return 'student';
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('lms_token');
    const savedUser = localStorage.getItem('lms_user');

    if (savedToken && savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        setRoleState(mapDbRole(u.role));

        // Verify session against backend to ensure account hasn't been deleted or revoked
        import('@/lib/api').then(({ default: api }) => {
          api
            .get('/auth/me')
            .then((res) => {
              // Update local storage with fresh user data in case roles changed
              if (res.data) {
                const freshUser = { ...u, role: res.data.rol, foto_url: res.data.foto_url };
                setUser(freshUser);
                setRoleState(mapDbRole(res.data.rol));
                localStorage.setItem('lms_user', JSON.stringify(freshUser));
              }
            })
            .catch((err) => {
              // If 401 Unauthorized, check whether it's active revocation or simple expiry
              if (err.response?.status === 401) {
                const msg = (err.response?.data?.message || '').toLowerCase();
                const isActiveRevocation =
                  msg.includes('revocada') || msg.includes('eliminada') || msg.includes('desactivada');

                logout();
                // Only show expired/revoked message if the user was actively inside the dashboard.
                // If they're on /login or just opening the app with a stale token, silently clear.
                const isOnDashboard = window.location.pathname.startsWith('/dashboard');
                if (isOnDashboard) {
                  window.location.href = isActiveRevocation ? '/login?revoked=true' : '/login?expired=true';
                }
              }
            })
            .finally(() => {
              setIsHydrated(true);
            });
        });
      } catch (e) {
        logout();
      }
    } else {
      // No saved session — mark as hydrated immediately
      setIsHydrated(true);
    }
    setMounted(true);
  }, []);

  const syncSession = (tokenStr: string, userData: any) => {
    localStorage.setItem('lms_token', tokenStr);
    localStorage.setItem('lms_user', JSON.stringify(userData));
    setUser(userData);
    setRoleState(mapDbRole(userData.role));
    setIsHydrated(true); // Fresh login — session is already verified
  };

  const logout = () => {
    setLoggingOut(true);
    // Revoke token server-side (fire-and-forget — don't block on network errors)
    const token = localStorage.getItem('lms_token');
    if (token) {
      const apiUrl = getEnv().apiUrl;
      fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {}); // Ignore errors — local cleanup happens regardless
    }
    // Clean ALL LMS-related localStorage keys
    const keysToRemove = Object.keys(localStorage).filter((k) => k.startsWith('lms_'));
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    setUser(null);
    window.location.href = '/login';
  };

  if (!mounted) return <div className="min-h-screen bg-muted/20" />;

  if (loggingOut)
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <PageLoader message="Cerrando sesión..." />
      </div>
    );

  return (
    <RoleContext.Provider
      value={{
        role,
        user,
        isHydrated,
        logout,
        syncSession,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
