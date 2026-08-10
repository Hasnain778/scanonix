"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, SupabaseClient, User } from "@supabase/supabase-js";
import { isSupabaseConfiguredClient } from "@/config/env.public";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/auth";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** True only when Supabase returns both a validated user and an active session. */
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SYNC_AUTH_EVENTS = new Set<AuthChangeEvent>([
  "SIGNED_IN",
  "USER_UPDATED",
  "TOKEN_REFRESHED",
  "INITIAL_SESSION",
]);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  return (data as Profile | null) ?? null;
}

function isSyncCurrent(
  syncId: number,
  syncIdRef: React.MutableRefObject<number>,
): boolean {
  return syncId === syncIdRef.current;
}

async function syncAuthState(
  supabase: SupabaseClient,
  syncId: number,
  syncIdRef: React.MutableRefObject<number>,
  setUser: (user: User | null) => void,
  setProfile: (profile: Profile | null) => void,
): Promise<void> {
  const {
    data: { user: currentUser },
    error: userError,
  } = await supabase.auth.getUser();

  if (!isSyncCurrent(syncId, syncIdRef)) {
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!isSyncCurrent(syncId, syncIdRef)) {
    return;
  }

  if (userError || !currentUser || !session) {
    setUser(null);
    setProfile(null);
    return;
  }

  setUser(currentUser);
  setProfile(null);

  const nextProfile = await fetchProfile(currentUser.id);

  if (!isSyncCurrent(syncId, syncIdRef)) {
    return;
  }

  if (nextProfile && nextProfile.id !== currentUser.id) {
    setProfile(null);
    return;
  }

  setProfile(nextProfile);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfiguredClient());
  const syncIdRef = useRef(0);

  const invalidateAuthSync = useCallback(() => {
    syncIdRef.current += 1;
  }, []);

  const clearAuth = useCallback(() => {
    invalidateAuthSync();
    setUser(null);
    setProfile(null);
    setLoading(false);
  }, [invalidateAuthSync]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfiguredClient()) {
      clearAuth();
      return;
    }

    const syncId = ++syncIdRef.current;
    const supabase = createClient();
    await syncAuthState(supabase, syncId, syncIdRef, setUser, setProfile);
    setLoading(false);
  }, [clearAuth]);

  useEffect(() => {
    if (!isSupabaseConfiguredClient()) {
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    void (async () => {
      const syncId = ++syncIdRef.current;
      await syncAuthState(supabase, syncId, syncIdRef, setUser, setProfile);
      if (!cancelled) {
        setLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) {
        return;
      }

      if (event === "SIGNED_OUT") {
        invalidateAuthSync();
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (SYNC_AUTH_EVENTS.has(event)) {
        void (async () => {
          const syncId = ++syncIdRef.current;
          await syncAuthState(supabase, syncId, syncIdRef, setUser, setProfile);
          if (!cancelled) {
            setLoading(false);
          }
        })();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [invalidateAuthSync]);

  const activeProfile =
    user && profile?.id === user.id ? profile : null;
  const isAuthenticated = Boolean(user);

  const value = useMemo(
    () => ({
      user,
      profile: activeProfile,
      loading,
      isAuthenticated,
      refresh,
      clearAuth,
    }),
    [user, activeProfile, loading, isAuthenticated, refresh, clearAuth],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
