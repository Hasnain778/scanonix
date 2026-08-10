"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

const variantStyles: Record<ToastVariant, string> = {
  success: "border-green-500/25",
  error: "border-red-500/25",
  warning: "border-amber-500/25",
  info: "border-white/10",
};

function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "success") {
    return (
      <svg className="h-5 w-5 shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (variant === "error") {
    return (
      <svg className="h-5 w-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (variant === "warning") {
    return (
      <svg className="h-5 w-5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5 shrink-0 text-scanonix-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const timeoutRef = useRef<number | null>(null);

  const scheduleDismiss = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    scheduleDismiss();
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [scheduleDismiss]);

  return (
    <div
      role="status"
      className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl border bg-scanonix-surface/95 px-4 py-3 shadow-xl backdrop-blur-md ${variantStyles[toast.variant]}`}
      onMouseEnter={() => {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      }}
      onMouseLeave={scheduleDismiss}
    >
      <ToastIcon variant={toast.variant} />
      <p className="flex-1 text-sm font-medium leading-snug text-white">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="focus-ring shrink-0 rounded-md p-1 text-scanonix-muted transition-colors hover:bg-white/5 hover:text-white"
        aria-label="Dismiss notification"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const recentRef = useRef<{ message: string; variant: ToastVariant; at: number } | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const now = Date.now();
    const recent = recentRef.current;
    if (
      recent &&
      recent.message === message &&
      recent.variant === variant &&
      now - recent.at < 2000
    ) {
      return;
    }
    recentRef.current = { message, variant, at: now };

    const id = crypto.randomUUID();
    setToasts((current) => [...current.slice(-4), { id, message, variant }]);
  }, []);

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
