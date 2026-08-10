import { isOpenAiConfigured } from "@/config/env";
import { buildScanAssistantContext } from "@/lib/ai/scan-assistant/build-context";
import { generateDeterministicAssistantResponse } from "@/lib/ai/scan-assistant/fallback";
import {
  buildScanAssistantSystemMessage,
  SCAN_ASSISTANT_SYSTEM_PROMPT,
} from "@/lib/ai/scan-assistant/prompts";
import type {
  GenerateAssistantResponseInput,
  GenerateAssistantResponseResult,
} from "@/lib/ai/scan-assistant/types";
import { SCAN_ASSISTANT_LIMITS } from "@/lib/ai/scan-assistant/types";
import { getAiProvider } from "@/lib/ai/providers";
import { OpenAiProviderError } from "@/lib/ai/providers/openai";
import type { AiChatMessage } from "@/lib/ai/providers/types";

function trimHistory(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): AiChatMessage[] {
  return history
    .slice(-SCAN_ASSISTANT_LIMITS.maxHistoryInPrompt)
    .map((entry) => ({
      role: entry.role,
      content: entry.content.slice(0, SCAN_ASSISTANT_LIMITS.maxUserMessageLength),
    }));
}

export async function generateScanAssistantResponse(
  input: GenerateAssistantResponseInput,
): Promise<GenerateAssistantResponseResult> {
  const context = buildScanAssistantContext(input.report);
  const userMessage = input.userMessage.trim().slice(0, SCAN_ASSISTANT_LIMITS.maxUserMessageLength);

  if (!userMessage) {
    return {
      content: "Please enter a question about this scan report.",
      source: "deterministic",
      tokensUsed: null,
    };
  }

  const useCloud = input.preferCloudAi && isOpenAiConfigured();
  const provider = useCloud ? getAiProvider() : null;

  if (!provider) {
    return {
      content: generateDeterministicAssistantResponse(input.report, context, userMessage),
      source: "deterministic",
      tokensUsed: null,
    };
  }

  const messages: AiChatMessage[] = [
    { role: "system", content: buildScanAssistantSystemMessage(context) },
    ...trimHistory(input.history),
    { role: "user", content: userMessage },
  ];

  try {
    const result = await provider.complete(messages, {
      maxTokens: SCAN_ASSISTANT_LIMITS.maxTokens,
      temperature: 0.2,
    });

    return {
      content: result.content,
      source: "ai",
      tokensUsed: result.tokensUsed,
    };
  } catch (error) {
    if (error instanceof OpenAiProviderError) {
      return {
        content: generateDeterministicAssistantResponse(input.report, context, userMessage),
        source: "deterministic",
        tokensUsed: null,
      };
    }

    throw error;
  }
}

export { SCAN_ASSISTANT_SYSTEM_PROMPT, buildScanAssistantContext };
