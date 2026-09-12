"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Link2,
  Mail,
  Phone,
  Type,
  Wifi,
} from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import {
  buildMailtoLink,
  buildTelLink,
  isSafeHttpUrl,
} from "@/lib/tools/qr-scanner/parse-result";
import type { ParsedQrResult, QrResultType } from "@/lib/tools/qr-scanner/types";

interface QrResultPanelProps {
  result: ParsedQrResult;
  onScanAnother: () => void;
}

const RESULT_TYPE_PRESENTATION: Record<
  QrResultType,
  { eyebrow: string; title: string; Icon: typeof Link2 }
> = {
  url: { eyebrow: "URL", title: "Website link", Icon: Link2 },
  email: { eyebrow: "EMAIL", title: "Email address", Icon: Mail },
  phone: { eyebrow: "PHONE", title: "Phone number", Icon: Phone },
  wifi: { eyebrow: "WI-FI", title: "Wi-Fi details", Icon: Wifi },
  text: { eyebrow: "TEXT", title: "Text", Icon: Type },
};

export function QrResultPanel({ result, onScanAnother }: QrResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const presentation = RESULT_TYPE_PRESENTATION[result.type];
  const TypeIcon = presentation.Icon;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.raw);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleOpenLink = () => {
    if (!result.url || !isSafeHttpUrl(result.url)) return;
    window.open(result.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <div className="mb-5 flex items-start gap-3 pr-24 sm:pr-36 md:pr-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-600">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">
            QR code detected
          </h2>
          <p className="mt-0.5 text-sm text-foreground-muted">
            Decoded locally in your browser
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 pr-16 sm:pr-28 md:pr-0">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-scanonix-orange/40 bg-scanonix-orange/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-scanonix-orange">
          <TypeIcon className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2} />
          {presentation.eyebrow}
        </span>
        <span className="text-sm font-medium text-foreground">
          {presentation.title}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-surface-muted p-4 pr-6 sm:pr-4">
        {result.type === "wifi" && result.wifi ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-foreground-muted">Network name</dt>
              <dd className="mt-1 font-medium text-foreground">{result.wifi.ssid}</dd>
            </div>
            <div>
              <dt className="text-foreground-muted">Security</dt>
              <dd className="mt-1 text-foreground">{result.wifi.security}</dd>
            </div>
            {result.wifi.password && (
              <div>
                <dt className="text-foreground-muted">Password</dt>
                <dd className="mt-1 break-all font-mono text-foreground">
                  {result.wifi.password}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="break-all text-sm leading-relaxed text-foreground">
            {result.displayValue}
          </p>
        )}
      </div>

      {result.raw !== result.displayValue && (
        <div className="mt-3 rounded-xl border border-border bg-surface-muted/70 p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Raw content
          </p>
          <p className="break-all font-mono text-xs leading-relaxed text-foreground">
            {result.raw}
          </p>
        </div>
      )}

      {result.type === "wifi" && result.raw && (
        <div className="mt-3 rounded-xl border border-border bg-surface-muted/70 p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Raw content
          </p>
          <p className="break-all font-mono text-xs leading-relaxed text-foreground">
            {result.raw}
          </p>
        </div>
      )}

      {/*
        Copy + Scan another: md+ in-panel only (sticky owns <md).
        Type actions stay in-panel at all widths — right pad clears ToolFinder FAB.
      */}
      <div className="mt-5 flex flex-col gap-3 pr-24 sm:flex-row sm:flex-wrap sm:pr-36 md:pr-0 lg:pr-0">
        <div className="hidden w-full md:block md:w-auto">
          <ActionButton
            size="lg"
            className="w-full sm:w-auto"
            onClick={handleCopy}
          >
            {copied ? "Copied!" : "Copy result"}
          </ActionButton>
        </div>

        {result.type === "url" && result.url && isSafeHttpUrl(result.url) && (
          <ActionButton
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={handleOpenLink}
          >
            Open link safely
          </ActionButton>
        )}

        {result.type === "email" && result.email && (
          <ActionButton
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => {
              window.location.href = buildMailtoLink(result.email!);
            }}
          >
            Send email
          </ActionButton>
        )}

        {result.type === "phone" && result.phone && (
          <ActionButton
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => {
              window.location.href = buildTelLink(result.phone!);
            }}
          >
            Call phone number
          </ActionButton>
        )}

        <div className="hidden w-full md:block md:w-auto">
          <ActionButton
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={onScanAnother}
          >
            Scan another code
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
