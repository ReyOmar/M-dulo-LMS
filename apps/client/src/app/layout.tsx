import './globals.css';
import { type Metadata } from 'next';
import localFont from 'next/font/local';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { RoleProvider } from '@/contexts/RoleContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { AlertProvider } from '@/contexts/AlertContext';
import { WebSocketProvider } from '@/contexts/WebSocketContext';

// Use local font to avoid network dependency during builds
const inter = localFont({
  src: './fonts/Inter.woff2',
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
          : `${apiUrl}/storage/download/public/${data.favicon_url}`;
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
        {/* 
          CRITICAL: Inline blocking script to apply cached theme BEFORE any CSS/React renders.
          Must be a raw <script> tag (NOT next/script) to guarantee synchronous execution
          before the first paint. External scripts (even with beforeInteractive) can execute
          after CSS has already painted the default blue theme, causing a flash.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var c=JSON.parse(localStorage.getItem('lms_config_cache'));if(c){var d=document.documentElement.style;function h2l(hex){hex=hex.replace('#','');if(hex.length===3)hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];var r=parseInt(hex.substring(0,2),16)/255,g=parseInt(hex.substring(2,4),16)/255,b=parseInt(hex.substring(4,6),16)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),h=0,s=0,l=(mx+mn)/2;if(mx!==mn){var dd=mx-mn;s=l>0.5?dd/(2-mx-mn):dd/(mx+mn);switch(mx){case r:h=(g-b)/dd+(g<b?6:0);break;case g:h=(b-r)/dd+2;break;case b:h=(r-g)/dd+4;break;}h/=6;}return Math.round(h*360)+' '+Math.round(s*100)+'% '+Math.round(l*100)+'%';}if(c.color_primario){var p=h2l(c.color_primario);d.setProperty('--primary',p);d.setProperty('--ring',p);}if(c.color_secundario){d.setProperty('--secondary',h2l(c.color_secundario));}var rr=c.border_radius!=null?c.border_radius:12;var f=c.fuente?'"'+c.fuente+'",ui-sans-serif,system-ui,sans-serif':null;var fr=f?'*,*::before,*::after{font-family:'+f+' !important;}':'';var st=document.createElement('style');st.id='lms-theme-override';st.textContent=':root{--radius:'+rr+'px!important;--radius-sm:'+Math.max(0,rr-4)+'px!important;--radius-md:'+Math.max(0,rr-2)+'px!important;--radius-lg:'+rr+'px!important;--radius-xl:'+(rr>0?rr+4:0)+'px!important;--radius-2xl:'+(rr>0?rr+8:0)+'px!important;--radius-3xl:'+(rr>0?rr+12:0)+'px!important;--radius-4xl:'+(rr>0?rr+16:0)+'px!important;}'+fr;document.head.appendChild(st);if(f)d.setProperty('--font-sans',f);}}catch(e){}`,
          }}
        />
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
