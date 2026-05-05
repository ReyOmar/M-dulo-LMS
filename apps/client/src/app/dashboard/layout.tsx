import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationCenter } from "@/components/features/NotificationCenter";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-muted/20">
      <Sidebar />
      <main className="flex-1 ml-80 p-8 relative min-h-screen overflow-hidden">
        {/* Notification Bell — fixed top-right of content area */}
        <div className="fixed top-5 right-6 z-40">
          <NotificationCenter />
        </div>
        {children}
      </main>
    </div>
  );
}
