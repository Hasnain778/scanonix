"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { buttonTap, staggerContainer } from "@/components/dashboard/dashboard-motion";

interface QuickAction {
  href: string;
  emoji: string;
  label: string;
  description: string;
}

function buildQuickActions(latestScanId?: string | null): QuickAction[] {
  const assistantHref = latestScanId
    ? `/scan-results/${latestScanId}`
    : "/tools/security-scan";

  return [
    {
      href: "/tools/security-scan?type=website",
      emoji: "🌐",
      label: "Website Scan",
      description: "Check any URL for threats",
    },
    {
      href: "/monitors",
      emoji: "📊",
      label: "Monitoring",
      description: "Watch sites for changes",
    },
    {
      href: assistantHref,
      emoji: "🤖",
      label: "AI Assistant",
      description: latestScanId
        ? "Ask about your latest scan"
        : "Run a scan to get AI help",
    },
  ];
}

interface DashboardQuickActionsProps {
  latestScanId?: string | null;
}

export function DashboardQuickActions({ latestScanId }: DashboardQuickActionsProps) {
  const actions = buildQuickActions(latestScanId);

  return (
    <section aria-labelledby="quick-actions-heading">
      <div className="mb-5">
        <h2 id="quick-actions-heading" className="text-lg font-semibold text-white">
          Quick actions
        </h2>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {actions.map((action) => (
          <motion.div key={action.label} {...buttonTap}>
            <Link
              href={action.href}
              className="dashboard-scan-card group flex h-full flex-col rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50"
            >
              <div
                className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-scanonix-orange/12 text-3xl transition-transform group-hover:scale-105 group-hover:shadow-[0_0_24px_rgba(255,106,0,0.2)]"
                aria-hidden="true"
              >
                {action.emoji}
              </div>
              <h3 className="text-base font-semibold text-white">{action.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-scanonix-muted">
                {action.description}
              </p>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
