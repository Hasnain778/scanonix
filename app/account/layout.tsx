export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { requireAuth } from "@/lib/auth/session";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  await requireAuth();

  return <AppPageLayout>{children}</AppPageLayout>;
}
