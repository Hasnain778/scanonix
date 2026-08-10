import { type ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageBackground } from "@/components/ui/PageBackground";

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <>
      <PageBackground />
      <Navbar />
      <main className="relative flex min-h-screen items-center justify-center px-4 pt-24 pb-20 sm:pt-28">
        <div className="w-full max-w-md">
          <div className="surface-card rounded-2xl p-6 sm:p-8">
            <h1 className="text-page-title">{title}</h1>
            <p className="text-page-description mt-3">{description}</p>
            <div className="mt-6">{children}</div>
            {footer ? (
              <div className="mt-6 border-t border-white/10 pt-6 text-center text-sm text-scanonix-muted">
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

interface AuthMessageProps {
  type: "error" | "success";
  message: string;
}

export function AuthMessage({ type, message }: AuthMessageProps) {
  const styles =
    type === "error"
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : "border-green-500/30 bg-green-500/10 text-green-200";

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${styles}`}
      role={type === "error" ? "alert" : "status"}
    >
      {message}
    </div>
  );
}
