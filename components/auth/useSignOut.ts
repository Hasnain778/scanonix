"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { clientSignOut } from "@/lib/auth/client-sign-out";

export function useSignOut() {
  const router = useRouter();
  const { clearAuth } = useAuth();

  return useCallback(
    async (redirectTo = "/login") => {
      clearAuth();
      await clientSignOut();
      router.refresh();
      router.push(redirectTo);
    },
    [clearAuth, router],
  );
}
