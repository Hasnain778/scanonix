import { AdminSystemPanel } from "@/components/admin/AdminSystemPanel";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminSystemPage() {
  return (
    <AdminShell
      title="System"
      description="Environment, database, queue, storage, and provider status."
    >
      <AdminSystemPanel />
    </AdminShell>
  );
}
