"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="report-card overflow-hidden rounded-2xl border border-white/8 bg-[#0c0c0c]/50">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-white/[0.02] sm:px-8 sm:py-6"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span className="block text-lg font-semibold text-white">{title}</span>
          {description ? (
            <span className="mt-1 block text-base text-scanonix-muted">{description}</span>
          ) : null}
        </span>
        <svg
          className={`mt-1 h-5 w-5 shrink-0 text-scanonix-muted transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-6 border-t border-white/6 px-6 py-6 sm:px-8 sm:py-8">
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
