"use client";

import { useEffect, useState } from "react";

interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  showLabel?: boolean;
  striped?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getGradientColor(pct: number): string {
  if (pct >= 80) return "from-success to-emerald-400";
  if (pct >= 50) return "from-warning to-amber-400";
  if (pct >= 25) return "from-orange-500 to-amber-500";
  return "from-destructive to-red-400";
}

export function ProgressBar({ value, max = 100, showLabel = false, striped = false, size = "md", className = "" }: ProgressBarProps) {
  const [animated, setAnimated] = useState(false);
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const heightClass = size === "sm" ? "h-1.5" : size === "md" ? "h-2.5" : "h-4";

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Progreso</span>
          <span className="text-xs font-bold text-foreground">{Math.round(pct)}%</span>
        </div>
      )}
      <div className={`w-full bg-muted rounded-full overflow-hidden ${heightClass}`}>
        <div
          className={`
            ${heightClass} rounded-full bg-gradient-to-r ${getGradientColor(pct)}
            transition-all duration-800 ease-out
            ${striped ? "bg-[length:1rem_1rem] bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)] animate-[shimmer_1s_linear_infinite]" : ""}
          `}
          style={{ width: animated ? `${pct}%` : "0%" }}
        />
      </div>
    </div>
  );
}
