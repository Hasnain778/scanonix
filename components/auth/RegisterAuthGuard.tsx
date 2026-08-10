"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoadingState } from "@/components/common/LoadingState";

export function RegisterAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, loading, router]);

  if (loading || isAuthenticated) {
    return <LoadingState title="Loading…" className="py-8" />;
  }

  return children;
}
