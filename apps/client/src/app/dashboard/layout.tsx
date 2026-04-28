import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-muted/20">
      <Sidebar />
      <main className="flex-1 ml-80 p-8 relative min-h-screen overflow-hidden">
        {children}
      </main>
    </div>
  );
}
