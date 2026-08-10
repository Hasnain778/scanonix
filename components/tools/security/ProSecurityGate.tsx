"use client";

import Link from "next/link";
import { Shield, Lock } from "lucide-react";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { ProBadge } from "@/components/tools/background-remover/ProBadge";

interface ProSecurityGateProps {
  title?: string;
  description?: string;
  isAuthenticated?: boolean;
}

export function ProSecurityGate({
  title = "Pro security feature",
  description = "Upgrade to Scanonix Pro to process files, run scans, and access advanced security tools.",
  isAuthenticated = true,
}: ProSecurityGateProps) {
  return (
    <div className="rounded-2xl border border-scanonix-orange/30 bg-gradient-to-br from-scanonix-orange/10 via-[#141414] to-[#0e0e0e] p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-scanonix-orange/30 bg-scanonix-orange/15 text-scanonix-orange">
          <Shield className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <ProBadge />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-scanonix-muted">{description}</p>

          <ul className="mt-4 space-y-2 text-sm text-scanonix-muted">
            <li className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-scanonix-orange" aria-hidden="true" />
              Server-side processing with encrypted delivery
            </li>
            <li className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-scanonix-orange" aria-hidden="true" />
              Higher upload limits and priority security scans
            </li>
            <li className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-scanonix-orange" aria-hidden="true" />
              Website monitoring and saved scan history
            </li>
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!isAuthenticated ? (
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl bg-scanonix-orange px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400"
              >
                Sign in to continue
              </Link>
            ) : (
              <>
                <CheckoutButton plan="pro" interval="monthly" label="Upgrade to Pro" />
                <Link
                  href="/pricing"
                  className="text-sm font-medium text-scanonix-orange transition hover:text-orange-300"
                >
                  Compare plans
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
