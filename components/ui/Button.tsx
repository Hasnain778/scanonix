import Link from "next/link";
import { type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "glass" | "pro";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  external?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-scanonix-orange text-white hover:bg-scanonix-orange-light border border-scanonix-orange/20 hover:shadow-[var(--shadow-orange-sm)]",
  secondary:
    "bg-[var(--scanonix-bg-elevated)] text-white border border-white/12 hover:border-[var(--scanonix-orange-muted)]",
  ghost:
    "bg-transparent text-scanonix-muted hover:bg-white/5 hover:text-white border border-transparent",
  outline:
    "bg-transparent text-white border border-white/12 hover:border-scanonix-orange/50 hover:bg-scanonix-orange/5",
  glass:
    "glass text-white border-white/10 hover:border-scanonix-orange/35 hover:bg-white/5",
  pro:
    "bg-scanonix-orange/10 text-scanonix-orange border border-scanonix-orange/30 hover:bg-scanonix-orange/15 hover:border-scanonix-orange/45",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "min-h-[var(--button-height-sm)] px-4 py-2 text-sm gap-1.5",
  md: "min-h-[var(--button-height-md)] px-5 py-2.5 text-sm gap-2",
  lg: "min-h-[var(--button-height-lg)] px-6 py-3 text-base gap-2.5",
};

export function Button({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
  external = false,
}: ButtonProps) {
  const classes = `group inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 motion-reduce:transition-none motion-reduce:hover:transform-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  if (external) {
    return (
      <a
        href={href}
        className={classes}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
