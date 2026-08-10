import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageBackground } from "@/components/ui/PageBackground";

interface AppPageLayoutProps {
  children: ReactNode;
}

export function AppPageLayout({ children }: AppPageLayoutProps) {
  return (
    <>
      <PageBackground />
      <AppShell>{children}</AppShell>
    </>
  );
}
