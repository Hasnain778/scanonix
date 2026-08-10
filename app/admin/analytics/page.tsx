import { AdminAnalyticsPanel } from "@/components/admin/AdminAnalyticsPanel";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminAnalyticsPage() {
  return (
    <AdminShell
      title="Analytics"
      description="Trends for scans, users, revenue, and threat categories."
    >
      <AdminAnalyticsPanel />
    </AdminShell>
  );
}
