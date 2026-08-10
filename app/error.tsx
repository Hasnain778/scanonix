"use client";

import { useEffect } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageBackground } from "@/components/ui/PageBackground";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <PageBackground />
      <Navbar />
      <main className="relative flex min-h-screen items-center justify-center px-4 pt-24 pb-20">
        <div className="max-w-lg rounded-2xl border border-red-500/30 bg-scanonix-surface/90 p-8 text-center">
          <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
          <p className="mt-3 text-sm leading-relaxed text-scanonix-muted">
            An unexpected error occurred. Your files were not uploaded — please try
            again or return to the tools directory.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <ActionButton onClick={reset}>Try again</ActionButton>
            <ActionButton variant="outline" onClick={() => (window.location.href = "/tools")}>
              All tools
            </ActionButton>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
