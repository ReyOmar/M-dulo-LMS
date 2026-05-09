"use client";

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message = "Cargando..." }: PageLoaderProps) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 animate-fade-slide-in">
      {/* Animated road/route loader */}
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-primary animate-pulse"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        {/* Pulsing ring */}
        <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-ping" />
      </div>

      {/* Loading bar */}
      <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary via-accent to-primary rounded-full"
          style={{
            width: "40%",
            animation: "shimmer 1.2s ease-in-out infinite",
            backgroundSize: "200% 100%",
          }}
        />
      </div>

      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}
