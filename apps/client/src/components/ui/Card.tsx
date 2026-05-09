"use client";

import { ReactNode, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "interactive" | "stat";
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
}

const variantClasses: Record<string, string> = {
  default: "bg-card border border-border/50 shadow-sm",
  elevated: "glass shadow-md",
  interactive: "bg-card border border-border/50 shadow-sm card-interactive cursor-pointer",
  stat: "glass border border-border/30 shadow-sm hover:shadow-md transition-shadow",
};

const paddingClasses: Record<string, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({ variant = "default", padding = "md", children, className = "", ...props }: CardProps) {
  return (
    <div className={`rounded-2xl overflow-hidden ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`} {...props}>
      {children}
    </div>
  );
}

// Subcomponents
function CardHeader({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 py-4 border-b border-border/30 bg-muted/10 ${className}`} {...props}>
      {children}
    </div>
  );
}

function CardBody({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

function CardFooter({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 py-4 border-t border-border/30 bg-muted/5 ${className}`} {...props}>
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
