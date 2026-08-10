import { isOpenAiConfigured } from "@/config/env";
import { OpenAiProvider } from "@/lib/ai/providers/openai";
import type { AiChatProvider } from "@/lib/ai/providers/types";

let cachedProvider: AiChatProvider | null = null;

/** Returns the configured cloud AI provider, or null when none is available. */
export function getAiProvider(): AiChatProvider | null {
  if (!isOpenAiConfigured()) {
    return null;
  }

  if (!cachedProvider) {
    cachedProvider = new OpenAiProvider();
  }

  return cachedProvider;
}

export type { AiChatProvider, AiChatMessage, AiCompletionResult } from "@/lib/ai/providers/types";
