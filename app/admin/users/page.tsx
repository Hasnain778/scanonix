import { Suspense } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminUserDetailPanel } from "@/components/admin/AdminUserDetailPanel";
import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";

export default function AdminUsersPage() {
  return (
    <AdminShell
      title="Users"
      description="Search, filter, and manage Scanonix accounts."
    >
      <Suspense fallback={null}>
        <AdminUserDetailPanel />
      </Suspense>
      <AdminUsersPanel />
    </AdminShell>
  );
}
