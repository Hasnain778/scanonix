"use client";

import { ToastProvider } from "@/hooks/useToast";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ToolFinderRoot } from "@/components/tool-finder/ToolFinderRoot";
import { type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        {children}
        <ToolFinderRoot />
      </AuthProvider>
    </ToastProvider>
  );
}
