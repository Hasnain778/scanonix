"use client";

import { ConsentRoot } from "@/components/analytics/ConsentRoot";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { MobileStickyActionSurfaceProvider } from "@/components/tools/MobileStickyActionSurfaceContext";
import { ToolFinderRoot } from "@/components/tool-finder/ToolFinderRoot";
import { ToastProvider } from "@/hooks/useToast";
import { type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <MobileStickyActionSurfaceProvider>
            <ConsentRoot>{children}</ConsentRoot>
            <ToolFinderRoot />
          </MobileStickyActionSurfaceProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
