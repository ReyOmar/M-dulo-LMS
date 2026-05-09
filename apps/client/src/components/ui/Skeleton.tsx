"use client";

import { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div className={`rounded-lg bg-muted animate-shimmer ${className}`} {...props} />
  );
}

function SkeletonLine({ width = "100%", className = "", ...props }: SkeletonProps & { width?: string }) {
  return <Skeleton className={`h-4 ${className}`} style={{ width }} {...props} />;
}

function SkeletonCircle({ size = 40, className = "", ...props }: SkeletonProps & { size?: number }) {
  return <Skeleton className={`rounded-full shrink-0 ${className}`} style={{ width: size, height: size }} {...props} />;
}

function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div className={`rounded-2xl border border-border/50 p-6 space-y-4 ${className}`}>
      <div className="flex items-center gap-3">
        <SkeletonCircle size={40} />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="60%" />
          <SkeletonLine width="40%" />
        </div>
      </div>
      <SkeletonLine />
      <SkeletonLine width="80%" />
    </div>
  );
}

function SkeletonChart({ className = "" }: SkeletonProps) {
  return (
    <div className={`rounded-2xl border border-border/50 p-6 ${className}`}>
      <div className="space-y-2 mb-4">
        <SkeletonLine width="30%" />
        <SkeletonLine width="20%" className="h-3" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

Skeleton.Line = SkeletonLine;
Skeleton.Circle = SkeletonCircle;
Skeleton.Card = SkeletonCard;
Skeleton.Chart = SkeletonChart;
