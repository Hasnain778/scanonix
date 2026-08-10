export const dynamic = "force-dynamic";

import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { requireAuth } from "@/lib/auth/session";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Dashboard",
  description: "Your Scanonix dashboard — tools, plan, and workspace overview.",
  path: "/dashboard",
  noIndex: true,
});

export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <AppPageLayout>
      <DashboardContent user={user} />
    </AppPageLayout>
  );
}
