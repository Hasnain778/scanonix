"use client";

import { motion } from "framer-motion";
import type { ScanReportIntelligence } from "@/lib/scan-report/types";

interface ScanReportDomainReputationProps {
  reputation: NonNullable<ScanReportIntelligence["domainReputation"]>;
}

const TRUST_STYLES: Record<
  NonNullable<ScanReportIntelligence["domainReputation"]>["trustLevel"],
  string
> = {
  high: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  moderate: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  low: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  poor: "border-red-500/30 bg-red-500/10 text-red-300",
};

function formatAge(ageDays: number | null): string {
  if (ageDays === null) return "Unknown";
  if (ageDays < 1) return "Less than 1 day";
  if (ageDays < 30) return `${ageDays} days`;
  if (ageDays < 365) return `${Math.floor(ageDays / 30)} months`;
  return `${Math.floor(ageDays / 365)} years`;
}

function formatDate(value: string | null): string {
  if (!value) return "Unknown";
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ScanReportDomainReputation({ reputation }: ScanReportDomainReputationProps) {
  const detailCards = [
    { icon: "📋", title: "Registrar", value: reputation.registration.registrar ?? "Unknown" },
    { icon: "📅", title: "Created", value: formatDate(reputation.registration.createdDate) },
    { icon: "⏳", title: "Expires", value: formatDate(reputation.registration.expiresDate) },
    { icon: "🌐", title: "Domain age", value: formatAge(reputation.registration.ageDays) },
    { icon: "🏢", title: "Hosting", value: reputation.infrastructure.hostingProvider ?? "Unknown" },
    { icon: "🔢", title: "ASN", value: reputation.infrastructure.asn ?? "Unknown" },
    { icon: "📧", title: "SPF", value: reputation.dnsHealth.hasSpf ? "Detected" : "Missing" },
    { icon: "🔐", title: "DMARC", value: reputation.dnsHealth.hasDmarc ? "Detected" : "Missing" },
  ];

  return (
    <section aria-labelledby="domain-reputation-heading">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="domain-reputation-heading" className="text-lg font-semibold text-foreground">
            Domain reputation
          </h3>
          <p className="mt-1 text-base text-scanonix-muted">{reputation.domain}</p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${TRUST_STYLES[reputation.trustLevel]}`}
        >
          {reputation.trustLevel} trust
        </span>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Reputation score" value={`${reputation.reputationScore}/100`} />
        <MetricCard label="DNS health" value={reputation.dnsHealth.level} />
        <MetricCard label="Domain age" value={formatAge(reputation.registration.ageDays)} />
        <MetricCard
          label="WHOIS"
          value={reputation.registration.whoisAvailable ? "Available" : "Unavailable"}
        />
      </div>

      <p className="mb-6 text-base leading-relaxed text-scanonix-muted">{reputation.summary}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {detailCards.map((card) => (
          <DetailCard key={card.title} icon={card.icon} title={card.title} value={card.value} />
        ))}
      </div>

      {reputation.riskReasons.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-xl border border-scanonix-orange/20 bg-scanonix-orange/5 p-4"
        >
          <p className="text-sm font-medium text-scanonix-orange">Risk reasons</p>
          <ul className="mt-2 space-y-1.5">
            {reputation.riskReasons.map((reason) => (
              <li key={reason} className="text-sm text-foreground">
                {reason}
              </li>
            ))}
          </ul>
        </motion.div>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
      <p className="text-sm text-scanonix-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold capitalize text-foreground">{value}</p>
    </div>
  );
}

function DetailCard({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-muted p-4">
      <div className="flex items-center gap-2">
        <span aria-hidden="true">{icon}</span>
        <p className="text-sm font-medium text-scanonix-muted">{title}</p>
      </div>
      <p className="mt-2 text-sm text-foreground break-all">{value}</p>
    </div>
  );
}
