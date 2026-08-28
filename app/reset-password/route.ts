import { type NextRequest, NextResponse } from "next/server";
import { RESET_PASSWORD_PATH } from "@/lib/auth/reset-password-url";

/** Legacy route — real HTTP redirect to /auth/reset-password (preserves query). */
export function GET(request: NextRequest) {
  const destination = new URL(RESET_PASSWORD_PATH, request.url);
  destination.search = request.nextUrl.search;
  return NextResponse.redirect(destination, 307);
}
