import { type ReactNode } from "react";
import { designTokens } from "@/lib/design/tokens";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export function GlassCard({
  children,
  className = "",
  hover = false,
  glow = false,
}: GlassCardProps) {
  return (
    <div
      className={`rounded-2xl ${hover ? designTokens.surfaceCardInteractive : designTokens.glassCard} transition-[border-color,box-shadow] duration-200 ${glow ? "glow-orange-sm" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
