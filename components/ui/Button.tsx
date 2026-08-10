import Link from "next/link";
import { type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "glass";
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
    "bg-scanonix-orange text-white hover:bg-scanonix-orange-light shadow-lg shadow-scanonix-orange/30 hover:shadow-xl hover:shadow-scanonix-orange/40 border border-scanonix-orange/20",
  secondary:
    "bg-white text-[#121212] hover:bg-neutral-100 shadow-lg shadow-white/10 border border-white/20",
  ghost:
    "bg-transparent text-white hover:bg-white/8 border border-transparent",
  outline:
    "bg-transparent text-white border border-white/15 hover:border-scanonix-orange/60 hover:text-scanonix-orange hover:bg-scanonix-orange/5",
  glass:
    "glass text-white border-white/10 hover:border-scanonix-orange/40 hover:bg-white/5",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm gap-1.5",
  md: "px-6 py-3 text-sm gap-2",
  lg: "px-8 py-4 text-base gap-2.5",
};

export function Button({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
  external = false,
}: ButtonProps) {
  const classes = `group inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

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
