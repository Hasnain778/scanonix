"use client";

import { motion } from "framer-motion";
import { DashboardTopBarControls } from "@/components/dashboard/DashboardTopBarControls";
import { getFirstName, getTimeGreeting } from "@/components/dashboard/dashboard-utils";
import type { AuthUser } from "@/types/auth";

interface DashboardHeaderProps {
  user: AuthUser;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const firstName = getFirstName(user);
  const greeting = getTimeGreeting();

  return (
    <header className="mb-2 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="min-w-0"
      >
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {greeting}, {firstName}
        </h1>
        <p className="mt-1.5 text-base leading-relaxed text-scanonix-muted">
          Here is your security overview for today.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.04 }}
        className="shrink-0 self-start sm:self-auto"
      >
        <DashboardTopBarControls />
      </motion.div>
    </header>
  );
}
