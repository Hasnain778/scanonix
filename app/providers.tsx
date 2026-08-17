"use client";

import { ConsentRoot } from "@/components/analytics/ConsentRoot";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ToolFinderRoot } from "@/components/tool-finder/ToolFinderRoot";
import { ToastProvider } from "@/hooks/useToast";
import { type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <ConsentRoot>{children}</ConsentRoot>
        <ToolFinderRoot />
      </AuthProvider>
    </ToastProvider>
  );
}
