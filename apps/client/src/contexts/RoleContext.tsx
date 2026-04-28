"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui/PageLoader";

export type Role = "admin" | "teacher" | "student";

interface RoleContextType {
  role: Role;
  realRole: Role;
  simulatedRole: Role | null;
  setSimulatedRole: (role: Role | null) => void;
  user: any;
  logout: () => void;
  syncSession: (tokenStr: string, userData: any) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("student");
  const [simulatedRole, setSimulatedRole] = useState<Role | null>(null);
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  const mapDbRole = (dbRole: string): Role => {
    if (dbRole === 'ADMINISTRADOR') return 'admin';
    if (dbRole === 'PROFESOR') return 'teacher';
    return 'student';
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("lms_token");
    const savedUser = localStorage.getItem("lms_user");
    
    if (savedToken && savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        setRoleState(mapDbRole(u.role));
      } catch (e) {
        logout();
      }
    }
    setMounted(true);
  }, []);

  const syncSession = (tokenStr: string, userData: any) => {
    localStorage.setItem("lms_token", tokenStr);
    localStorage.setItem("lms_user", JSON.stringify(userData));
    setUser(userData);
    setRoleState(mapDbRole(userData.role));
  };

  const logout = () => {
    setLoggingOut(true);
    localStorage.removeItem("lms_token");
    localStorage.removeItem("lms_user");
    setUser(null);
    setSimulatedRole(null);
    window.location.href = "/login";
  };

  const activeRole = simulatedRole || role;

  if (!mounted) return <div className="min-h-screen bg-muted/20" />;

  if (loggingOut) return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20">
      <PageLoader message="Cerrando sesión..." />
    </div>
  );

  return (
    <RoleContext.Provider value={{ 
      role: activeRole, 
      realRole: role, // allow components like Simulator to know who they actually are
      simulatedRole, 
      setSimulatedRole, 
      user, 
      logout, 
      syncSession 
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
