import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isSupabaseConfigured } from "@/config/env";

const PROTECTED_PREFIXES = ["/dashboard", "/account", "/history", "/saved-files", "/admin", "/monitors"];
const AUTH_PREFIXES = ["/login", "/register"];
const SESSION_BYPASS_PREFIXES = ["/auth/callback"];
const RECOVERY_PREFIXES = ["/auth/reset-password", "/forgot-password"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (matchesPrefix(pathname, SESSION_BYPASS_PREFIXES)) {
    return NextResponse.next({ request });
  }

  if (!isSupabaseConfigured()) {
    if (
      process.env.NODE_ENV === "production" &&
      matchesPrefix(pathname, PROTECTED_PREFIXES)
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.supabaseUrl,
    env.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (matchesPrefix(pathname, RECOVERY_PREFIXES)) {
    return supabaseResponse;
  }

  if (user && matchesPrefix(pathname, AUTH_PREFIXES)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
