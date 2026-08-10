import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { formTokens, designTokens } from "@/lib/design/tokens";

interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children?: ReactNode;
}

export function FormField({ id, label, hint, error, children }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className={formTokens.label}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className={formTokens.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className={formTokens.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${designTokens.input} ${className}`} {...props} />;
}

export function SelectField({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={`${designTokens.select} ${className}`} {...props}>
      {children}
    </select>
  );
}

interface SurfaceCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  interactive?: boolean;
  className?: string;
}

export function SurfaceCard({
  title,
  description,
  children,
  interactive = false,
  className = "",
}: SurfaceCardProps) {
  return (
    <section
      className={`${interactive ? designTokens.surfaceCardInteractive : designTokens.surfaceCard} ${designTokens.cardPadding} ${className}`}
    >
      <h2 className="text-section-title">{title}</h2>
      {description ? <p className="text-body mt-2">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
