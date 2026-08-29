import Link from "next/link";
import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ActionButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "glass";
type ActionButtonSize = "sm" | "md" | "lg";

interface ActionButtonBaseProps {
  children: ReactNode;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  loading?: boolean;
  className?: string;
}

type ActionButtonProps = ActionButtonBaseProps &
  (
    | (ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined })
    | ({ href: string } & Omit<ButtonHTMLAttributes<HTMLAnchorElement>, "href">)
  );

const variantStyles: Record<ActionButtonVariant, string> = {
  primary:
    "bg-brand text-on-brand hover:bg-brand-hover border border-scanonix-orange/25 shadow-md shadow-scanonix-orange/20 hover:shadow-scanonix-orange/30 disabled:opacity-50 disabled:shadow-none",
  secondary:
    "bg-surface-raised text-foreground border border-border hover:bg-surface-muted hover:border-border-strong disabled:opacity-50",
  outline:
    "border border-border bg-transparent text-foreground hover:border-scanonix-orange/50 hover:bg-brand-soft disabled:opacity-50",
  ghost:
    "text-foreground-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-50",
  glass:
    "glass text-foreground hover:border-scanonix-orange/35 disabled:opacity-50",
  danger:
    "border border-red-500/35 bg-red-500/10 text-red-400 hover:bg-red-500/15 hover:border-red-500/50 disabled:opacity-50",
};

const sizeStyles: Record<ActionButtonSize, string> = {
  sm: "min-h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "min-h-10 px-5 text-sm rounded-xl gap-2",
  lg: "min-h-11 px-8 text-base rounded-xl gap-2",
};

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`${className} animate-spin`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function getClasses(
  variant: ActionButtonVariant,
  size: ActionButtonSize,
  className: string,
  disabled?: boolean,
) {
  return `focus-ring relative inline-flex items-center justify-center font-semibold transition-[background-color,border-color,color,box-shadow,opacity] duration-200 ease-out disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${disabled ? "pointer-events-none opacity-50" : ""} ${className}`;
}

export function ActionButton({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  href,
  disabled,
  ...props
}: ActionButtonProps) {
  const classes = getClasses(variant, size, className, disabled || loading);

  if (href) {
    return (
      <Link href={href} className={classes} aria-busy={loading || undefined}>
        <span className="inline-flex items-center gap-2">{children}</span>
      </Link>
    );
  }

  return (
    <button
      type={(props as ButtonHTMLAttributes<HTMLButtonElement>).type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      <span className={loading ? "opacity-0" : "inline-flex items-center gap-2"}>
        {children}
      </span>
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      ) : null}
    </button>
  );
}
