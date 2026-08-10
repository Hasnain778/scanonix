export const dynamic = "force-dynamic";

import { MonitorDetailShell } from "@/components/monitors/MonitorDetailShell";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { requireAuth } from "@/lib/auth/session";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Monitor Timeline",
  description: "Security change timeline for a monitored website.",
  path: "/monitors/[id]",
  noIndex: true,
});

interface MonitorDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MonitorDetailPage({ params }: MonitorDetailPageProps) {
  await requireAuth();
  const { id } = await params;

  return (
    <AppPageLayout>
      <MonitorDetailShell monitorId={id} />
    </AppPageLayout>
  );
}
