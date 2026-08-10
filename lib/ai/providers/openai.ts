import { isOpenAiConfigured } from "@/config/env";
import { AI_SERVICE_UNAVAILABLE } from "@/lib/ai/messages";
import type {
  AiChatMessage,
  AiChatProvider,
  AiCompletionOptions,
  AiCompletionResult,
} from "@/lib/ai/providers/types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

export class OpenAiProviderError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = "OpenAiProviderError";
  }
}

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new OpenAiProviderError(AI_SERVICE_UNAVAILABLE, 503);
  }
  return key;
}

export class OpenAiProvider implements AiChatProvider {
  readonly name = "openai";
  readonly model = DEFAULT_MODEL;

  async complete(
    messages: AiChatMessage[],
    options: AiCompletionOptions = {},
  ): Promise<AiCompletionResult> {
    if (!isOpenAiConfigured()) {
      throw new OpenAiProviderError(AI_SERVICE_UNAVAILABLE, 503);
    }

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 2_500,
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!response.ok) {
      throw new OpenAiProviderError(
        `OpenAI request failed (${response.status}).`,
        response.status >= 500 ? 502 : 400,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new OpenAiProviderError("OpenAI returned an empty response.", 502);
    }

    return {
      content,
      tokensUsed: data.usage?.total_tokens ?? null,
      provider: this.name,
      model: this.model,
    };
  }
}
