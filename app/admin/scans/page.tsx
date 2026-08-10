import { AdminScansPanel } from "@/components/admin/AdminScansPanel";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminScansPage() {
  return (
    <AdminShell
      title="Scans"
      description="Browse all scan reports across the platform."
    >
      <AdminScansPanel />
    </AdminShell>
  );
}
