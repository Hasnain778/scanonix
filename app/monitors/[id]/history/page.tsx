export const dynamic = "force-dynamic";

import { MonitorHistoryShell } from "@/components/monitors/MonitorHistoryShell";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { requireAuth } from "@/lib/auth/session";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Monitor History",
  description: "Scheduled scan run history for a monitored website.",
  path: "/monitors/[id]/history",
  noIndex: true,
});

interface MonitorHistoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function MonitorHistoryPage({ params }: MonitorHistoryPageProps) {
  await requireAuth();
  const { id } = await params;

  return (
    <AppPageLayout>
      <MonitorHistoryShell monitorId={id} />
    </AppPageLayout>
  );
}
