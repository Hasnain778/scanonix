import { AdminMonitoringPanel } from "@/components/admin/AdminMonitoringPanel";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminMonitoringPage() {
  return (
    <AdminShell
      title="Monitoring"
      description="Scheduled security monitors, job queue, and notification pipeline."
    >
      <AdminMonitoringPanel />
    </AdminShell>
  );
}
