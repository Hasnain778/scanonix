/**
 * Cloud AI service — server-side OpenAI via API routes.
 * Client tools call /api/ai/* directly.
 */
import { isOpenAiConfigured, isSupabaseConfigured } from "@/config/env";

export type AiProcessingMode = "local" | "cloud";

export interface AiTextResponse {
  text: string;
  mode: AiProcessingMode;
}

export function getAiBackendStatus() {
  return {
    supabaseConfigured: isSupabaseConfigured(),
    openAiConfigured: isOpenAiConfigured(),
    edgeFunctionsReady: isSupabaseConfigured(),
    recommendedSetup: isOpenAiConfigured()
      ? "OpenAI is configured. AI summary and translate tools are ready."
      : "Cloud AI tools require server configuration.",
  };
}

export async function summarizeDocument(text: string): Promise<AiTextResponse> {
  const response = await fetch("/api/ai/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = (await response.json()) as { text?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Summary failed.");
  }
  return { text: data.text ?? "", mode: "cloud" };
}

export async function translateDocument(
  text: string,
  targetLanguage: string,
): Promise<AiTextResponse> {
  const response = await fetch("/api/ai/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, targetLanguage }),
  });
  const data = (await response.json()) as { text?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Translation failed.");
  }
  return { text: data.text ?? "", mode: "cloud" };
}

export async function chatWithDocument(
  context: string,
  message: string,
): Promise<AiTextResponse> {
  void context;
  void message;
  throw new Error("AI Document Chat is not available yet.");
}
