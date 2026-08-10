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
    <div className="grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
      <AccountNav />
      <div>
        <PageHeader title={title} description={description} />
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}
