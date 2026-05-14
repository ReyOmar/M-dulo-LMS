"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { useRole } from "@/contexts/RoleContext";
import { PageLoader } from "@/components/ui/PageLoader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isHydrated } = useRole();

  return (
    <div className="min-h-screen flex bg-muted/20">
      <a href="#main-content" className="skip-to-content">Saltar al contenido</a>
      <Sidebar />
      <main id="main-content" className="flex-1 lg:ml-80 p-4 pt-16 lg:p-8 lg:pt-8 relative min-h-screen overflow-hidden">
        {isHydrated ? children : <PageLoader message="Verificando sesión..." />}
      </main>
    </div>
  );
}
