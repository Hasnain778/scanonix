"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/ActionButton";
import { runSecurityScan } from "@/lib/scan-history/client";

function createScanId(): string {
  return crypto.randomUUID();
}

export function DashboardQuickScan() {
  const router = useRouter();
  const [websiteTarget, setWebsiteTarget] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (running) return false;
    return websiteTarget.trim().length > 0;
  }, [running, websiteTarget]);

  const handleRunScan = useCallback(async () => {
    const scanId = createScanId();
    setRunning(true);
    setError(null);

    try {
      const result = await runSecurityScan({
        scanId,
        targetType: "website",
        target: websiteTarget.trim(),
      });

      if ("error" in result && !("record" in result)) {
        setError(result.error);
        setRunning(false);
        return;
      }

      const scanResult = result as Extract<typeof result, { record: unknown }>;
      router.push(`/scan-results/${scanResult.record.id}`);
    } catch {
      setError("Scan failed. Please try again.");
      setRunning(false);
    }
  }, [router, websiteTarget]);

  return (
    <section
      aria-labelledby="quick-scan-heading"
      className="rounded-2xl border border-scanonix-orange/20 bg-[#0c0c0c]/50 p-5 sm:p-6"
    >
      <div className="mb-5">
        <h2 id="quick-scan-heading" className="text-lg font-semibold text-white">
          Quick scan
        </h2>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="dashboard-quick-scan-input flex min-h-[3.25rem] flex-1 items-center rounded-xl border border-white/10 bg-black/30 px-4 transition-all sm:min-h-14">
          <input
            type="url"
            inputMode="url"
            value={websiteTarget}
            onChange={(event) => setWebsiteTarget(event.target.value)}
            placeholder="Enter a website URL"
            className="w-full bg-transparent text-base text-white placeholder:text-scanonix-muted focus:outline-none"
            aria-label="Website URL to scan"
            disabled={running}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSubmit) {
                void handleRunScan();
              }
            }}
          />
        </div>

        <ActionButton
          size="lg"
          className="h-[3.25rem] w-full shrink-0 sm:h-14 sm:w-auto sm:min-w-[160px]"
          loading={running}
          disabled={!canSubmit}
          onClick={() => void handleRunScan()}
        >
          Scan Website
        </ActionButton>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
