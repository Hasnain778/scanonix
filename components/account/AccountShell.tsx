import type { ReactNode } from "react";
import { AccountNav } from "@/components/account/AccountNav";
import { PageHeader } from "@/components/ui/PageHeader";

interface AccountShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function AccountShell({ title, description, children }: AccountShellProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-8">
      <AccountNav />
      <div className="min-w-0">
        <PageHeader title={title} description={description} />
        <div className="mt-6 space-y-6">{children}</div>
      </div>
    </div>
  );
}
