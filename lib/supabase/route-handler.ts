import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import type { Database } from "@/types/database";

/**
 * Supabase client for Route Handlers — writes session cookies onto the response
 * that will be returned (required for exchangeCodeForSession / verifyOtp).
 */
export function createRouteHandlerClient(
  request: NextRequest,
  response: NextResponse,
) {
  return createServerClient<Database>(
    env.supabaseUrl,
    env.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );
}
