"use client";

export function PageLoader({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] animate-in fade-in duration-300">
      {/* Animated spinner */}
      <div className="relative h-14 w-14 mb-6">
        <div className="absolute inset-0 rounded-full border-[3px] border-border/30" />
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary animate-spin" />
        <div className="absolute inset-2 rounded-full border-[2px] border-transparent border-b-primary/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
      </div>

      {/* Pulsing text */}
      <p className="text-sm font-semibold text-muted-foreground animate-pulse">
        {message || 'Cargando...'}
      </p>
    </div>
  );
}
