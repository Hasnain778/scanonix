import { AdminDashboardPanel } from "@/components/admin/AdminDashboardPanel";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminDashboardPage() {
  return (
    <AdminShell
      title="Dashboard"
      description="Platform overview — users, scans, revenue, and system health at a glance."
    >
      <AdminDashboardPanel />
    </AdminShell>
  );
}
