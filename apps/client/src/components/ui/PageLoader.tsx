"use client";

import { useEffect, useState, useRef } from "react";

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message = "Cargando..." }: PageLoaderProps) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;

      // Phase 1: 0→70% in ~1.2s (fast start)
      // Phase 2: 70→90% in ~3s (slow crawl)
      // Phase 3: 90→95% in ~8s (barely moving — waiting for content)
      let target: number;
      if (elapsed < 1200) {
        target = (elapsed / 1200) * 70;
      } else if (elapsed < 4200) {
        target = 70 + ((elapsed - 1200) / 3000) * 20;
      } else {
        target = 90 + Math.min(((elapsed - 4200) / 8000) * 5, 5);
      }

      setProgress(Math.min(target, 95));
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    // Cleanup: snap to 100% and fade out when component unmounts (content loaded)
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // When this component is about to unmount, React won't render the fade.
  // Instead, we use a visual trick: the bar always looks alive and moving.

  return (
    <div
      className={`min-h-[60vh] flex flex-col items-center justify-center gap-6 transition-opacity duration-300 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* Animated icon */}
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        {/* Pulsing ring */}
        <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-ping" />
      </div>

      {/* Animated progress bar */}
      <div className="w-56 relative">
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden bg-primary"
            style={{
              width: `${progress}%`,
            }}
          >
            {/* Shimmer effect on the moving bar */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'pageLoaderShimmer 1.2s ease-in-out infinite',
              }}
            />
          </div>
        </div>
        {/* Percentage text */}
        <div className="flex justify-between mt-2">
          <span className="text-xs font-bold text-foreground/70 tabular-nums">
            {Math.round(progress)}%
          </span>
          <span className="text-[10px] font-bold text-muted-foreground">
            Procesando
          </span>
        </div>
      </div>

      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}
