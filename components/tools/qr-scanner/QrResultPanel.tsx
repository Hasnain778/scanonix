import { ActionButton } from "@/components/ui/ActionButton";
import {
  buildMailtoLink,
  buildTelLink,
  isSafeHttpUrl,
} from "@/lib/tools/qr-scanner/parse-result";
import type { ParsedQrResult } from "@/lib/tools/qr-scanner/types";
import { getQrResultTypeLabel } from "@/lib/tools/qr-scanner/types";
import { useState } from "react";

interface QrResultPanelProps {
  result: ParsedQrResult;
  onScanAnother: () => void;
}

export function QrResultPanel({ result, onScanAnother }: QrResultPanelProps) {
  const [copied, setCopied] = useState(false);

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
    <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">Results</h2>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-scanonix-orange/40 bg-scanonix-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-scanonix-orange">
          {getQrResultTypeLabel(result.type)}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-surface-muted p-4">
        {result.type === "wifi" && result.wifi ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-scanonix-muted">Network name</dt>
              <dd className="mt-1 font-medium text-foreground">{result.wifi.ssid}</dd>
            </div>
            <div>
              <dt className="text-scanonix-muted">Security</dt>
              <dd className="mt-1 text-foreground">{result.wifi.security}</dd>
            </div>
            {result.wifi.password && (
              <div>
                <dt className="text-scanonix-muted">Password</dt>
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

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <ActionButton
          size="lg"
          className="w-full sm:w-auto"
          onClick={handleCopy}
        >
          {copied ? "Copied!" : "Copy result"}
        </ActionButton>

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
  );
}
