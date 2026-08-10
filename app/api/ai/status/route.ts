import { NextResponse } from "next/server";
import { isOpenAiConfigured } from "@/config/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Returns whether OpenAI is configured — never exposes the key. */
export async function GET() {
  return NextResponse.json({ configured: isOpenAiConfigured() });
}
