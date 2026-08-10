import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { PageHeader } from "@/components/ui/PageHeader";

interface AdminShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function AdminShell({ title, description, children }: AdminShellProps) {
  return (
    <div className="page-container max-w-7xl">
      <PageHeader eyebrow="Admin" title={title} description={description} />

      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8">
        <AdminNav />
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
