import "./globals.css";
import { type Metadata } from "next";
import Script from "next/script";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { RoleProvider } from "@/contexts/RoleContext";
import { ConfigProvider } from "@/contexts/ConfigContext";
import { AlertProvider } from "@/contexts/AlertContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";

export async function generateMetadata(): Promise<Metadata> {
  let platformName = "Campus Virtual";
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3200/api';
    const res = await fetch(`${apiUrl}/configuracion`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.nombre_plataforma) {
        platformName = data.nombre_plataforma;
      }
    }
  } catch (error) {
    // Fallback if API is unreachable during SSR
  }

  return {
    title: platformName,
    description: "Plataforma Educativa Empresarial Moderna",
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Google Fonts — Inter (UI) + JetBrains Mono (data/IDs) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        {/* Blocking script to apply cached theme BEFORE any CSS/React renders — eliminates color flash */}
        <Script src="/theme-preload.js" strategy="beforeInteractive" />
      </head>
      <body suppressHydrationWarning className="min-h-screen bg-background font-sans antialiased text-foreground transition-colors duration-300">
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
          >
          <RoleProvider>
            <WebSocketProvider>
              <ConfigProvider>
                <AlertProvider>
                  {children}
                </AlertProvider>
              </ConfigProvider>
            </WebSocketProvider>
          </RoleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

