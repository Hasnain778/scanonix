import { AdminSubscriptionsPanel } from "@/components/admin/AdminSubscriptionsPanel";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminSubscriptionsPage() {
  return (
    <AdminShell
      title="Subscriptions"
      description="Plan distribution, active subscriptions, and MRR summary."
    >
      <AdminSubscriptionsPanel />
    </AdminShell>
  );
}
