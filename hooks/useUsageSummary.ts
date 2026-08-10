"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchUsageSummary,
  type UsageSummaryResponse,
} from "@/lib/plan/client";

async function loadUsageSummary(): Promise<{
  summary: UsageSummaryResponse | null;
  error: string | null;
}> {
  try {
    const next = await fetchUsageSummary();
    if (!next) {
      return { summary: null, error: "Usage summary unavailable." };
    }

    return { summary: next, error: null };
  } catch {
    return { summary: null, error: "Usage summary unavailable." };
  }
}

export function useUsageSummary() {
  const [summary, setSummary] = useState<UsageSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await loadUsageSummary();
    setSummary(result.summary);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await loadUsageSummary();
      if (cancelled) {
        return;
      }

      setSummary(result.summary);
      setError(result.error);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { summary, loading, error, refresh };
}
