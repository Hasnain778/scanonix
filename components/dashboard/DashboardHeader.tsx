"use client";

import { motion } from "framer-motion";
import { getFirstName, getPlanBadgeClass, getTimeGreeting } from "@/components/dashboard/dashboard-utils";
import type { AuthUser } from "@/types/auth";

interface DashboardHeaderProps {
  user: AuthUser;
  plan: string;
}

function formatPlanLabel(plan: string): string {
  if (plan === "free") return "Free";
  if (plan === "pro") return "Pro";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function DashboardHeader({ user, plan }: DashboardHeaderProps) {
  const firstName = getFirstName(user);
  const greeting = getTimeGreeting();

  return (
    <header className="surface-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="min-w-0"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-page-title text-xl sm:text-2xl">
              {greeting}, {firstName}
            </h1>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getPlanBadgeClass(plan)}`}
            >
              {formatPlanLabel(plan)}
            </span>
          </div>
          <p className="mt-2 text-sm text-scanonix-muted sm:text-base">
            Your workspace for PDF, image, AI, and security tools.
          </p>
          <p className="mt-1 text-xs text-scanonix-muted">{user.email}</p>
        </motion.div>
      </div>
    </header>
  );
}
