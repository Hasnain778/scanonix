import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { AuthUser } from "@/types/auth";

interface DashboardContentProps {
  user: AuthUser;
}

export function DashboardContent({ user }: DashboardContentProps) {
  return <DashboardShell user={user} />;
}
