export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { AccountOverviewHeader } from "@/components/account/AccountOverviewHeader";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { requireAuth } from "@/lib/auth/session";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await requireAuth();

  return (
    <AppPageLayout>
      <AccountOverviewHeader user={user} />
      {children}
    </AppPageLayout>
  );
}
