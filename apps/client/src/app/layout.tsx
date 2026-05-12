import './globals.css';
import { type Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { RoleProvider } from '@/contexts/RoleContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { AlertProvider } from '@/contexts/AlertContext';
import { WebSocketProvider } from '@/contexts/WebSocketContext';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
});

export async function generateMetadata(): Promise<Metadata> {
  let platformName = 'Campus Virtual';
  let faviconUrl: string | null = null;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3200/api';
    const res = await fetch(`${apiUrl}/configuracion`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(1500), // Reduced from 3s — don't block SSR too long
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.nombre_plataforma) {
        platformName = data.nombre_plataforma;
      }
      if (data?.favicon_url) {
        // Build the full download URL for the favicon
        faviconUrl = data.favicon_url.startsWith('http')
          ? data.favicon_url
          : `${apiUrl}/storage/download/${data.favicon_url}`;
      }
    }
  } catch {
    // Fallback silently — config will load client-side via ConfigContext
  }

  // Default favicon: a simple SVG with the first letter of the platform name
  const firstLetter = platformName.charAt(0).toUpperCase();
  const defaultFavicon = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23166534'/><text x='50' y='68' font-family='Arial' font-size='42' font-weight='bold' fill='white' text-anchor='middle'>${firstLetter}</text></svg>`;

  return {
    title: platformName,
    description: 'Plataforma Educativa Empresarial Moderna',
    icons: {
      icon: faviconUrl || defaultFavicon,
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Preconnect to Google Fonts for dynamic theme font loading (ConfigContext) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Blocking script to apply cached theme BEFORE any CSS/React renders — eliminates color flash */}
        <Script src="/theme-preload.js" strategy="beforeInteractive" />
      </head>
      <body
        suppressHydrationWarning
        className={`min-h-screen bg-background font-sans antialiased text-foreground transition-colors duration-300 ${inter.className}`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <RoleProvider>
            <WebSocketProvider>
              <ConfigProvider>
                <AlertProvider>{children}</AlertProvider>
              </ConfigProvider>
            </WebSocketProvider>
          </RoleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
