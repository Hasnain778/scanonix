"use client";

import { useEffect, useState } from "react";

export interface ProAccessState {
  loading: boolean;
  isAuthenticated: boolean;
  isPro: boolean;
  plan: "free" | "pro" | "business";
}

export function useProAccess(): ProAccessState {
  const [state, setState] = useState<ProAccessState>({
    loading: true,
    isAuthenticated: false,
    isPro: false,
    plan: "free",
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/billing/status", { cache: "no-store" });
        if (cancelled) return;

        if (!response.ok) {
          setState({
            loading: false,
            isAuthenticated: false,
            isPro: false,
            plan: "free",
          });
          return;
        }

        const data = (await response.json()) as {
          plan?: "free" | "pro" | "business";
          hasActiveSubscription?: boolean;
        };

        const plan = data.plan ?? "free";
        const isPro = plan === "pro" || plan === "business";

        setState({
          loading: false,
          isAuthenticated: true,
          isPro,
          plan,
        });
      } catch {
        if (!cancelled) {
          setState({
            loading: false,
            isAuthenticated: false,
            isPro: false,
            plan: "free",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
