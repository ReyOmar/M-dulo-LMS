import "./globals.css";
import { type Metadata } from "next";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { RoleProvider } from "@/contexts/RoleContext";
import { ConfigProvider } from "@/contexts/ConfigContext";

export const metadata: Metadata = {
  title: "Enterprise LMS Campus Virtual",
  description: "Plataforma Educativa Empresarial Moderna",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground transition-colors duration-300">
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
          >
          <RoleProvider>
            <ConfigProvider>
              {children}
            </ConfigProvider>
          </RoleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
