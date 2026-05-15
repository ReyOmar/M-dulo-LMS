"use client";

import { useEffect, useState, useRef, ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  icon: ReactNode;
  color?: "primary" | "accent" | "success" | "info" | "warning" | "destructive";
  trend?: { value: number; label: string };
  href?: string;
  className?: string;
}

const colorMap: Record<string, { bg: string; text: string; glow: string }> = {
  primary: { bg: "from-primary/15 to-primary/5", text: "text-primary", glow: "group-hover:shadow-[var(--shadow-glow-primary)]" },
  accent: { bg: "from-accent/15 to-accent/5", text: "text-accent", glow: "group-hover:shadow-[var(--shadow-glow-accent)]" },
  success: { bg: "from-success/15 to-success/5", text: "text-success", glow: "group-hover:shadow-[var(--shadow-glow-success)]" },
  info: { bg: "from-info/15 to-info/5", text: "text-info", glow: "group-hover:shadow-[var(--shadow-glow-primary)]" },
  warning: { bg: "from-warning/15 to-warning/5", text: "text-warning", glow: "group-hover:shadow-[var(--shadow-glow-accent)]" },
  destructive: { bg: "from-destructive/15 to-destructive/5", text: "text-destructive", glow: "" },
};

function useCountUp(target: number, duration = 600, decimals = 0): string {
  const [count, setCount] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    const start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(eased * target);
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
      else setCount(target); // Ensure exact final value
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return decimals > 0 ? count.toFixed(decimals) : Math.floor(count).toString();
}

export function StatCard({ label, value, suffix, decimals = 0, icon, color = "primary", trend, href, className = "" }: StatCardProps) {
  const animatedValue = useCountUp(value, 600, decimals);
  const c = colorMap[color];

  const Wrapper = href ? "a" : "div";
  const wrapperProps = href ? { href } : {};

  return (
    <Wrapper
      {...(wrapperProps as any)}
      className={`
        relative overflow-hidden rounded-2xl border border-border/50 p-5
        bg-card/70 backdrop-blur-md
        transition-all duration-300 group block
        hover:border-current/20 card-interactive
        ${c.glow} ${className}
      `}
    >
      {/* Background glow orb */}
      <div className={`absolute -top-8 -right-8 h-28 w-28 rounded-full bg-gradient-to-br ${c.bg} blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none`} />

      <div className="relative z-10 flex justify-between items-start">
        <div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
          <p className="text-3xl font-extrabold tracking-tight">
            {animatedValue}
            {suffix && <span className="text-base font-medium text-muted-foreground ml-0.5">{suffix}</span>}
          </p>
          {trend && (
            <p className={`text-xs font-semibold mt-2 flex items-center gap-1 ${trend.value >= 0 ? "text-success" : "text-destructive"}`}>
              <span>{trend.value >= 0 ? "↑" : "↓"}</span>
              {trend.label}
            </p>
          )}
        </div>
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${c.bg} group-hover:scale-110 transition-transform duration-200`}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
    </Wrapper>
  );
}
