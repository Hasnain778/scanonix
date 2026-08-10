export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCompletionOptions {
  /** Cap model output tokens to control cost/latency. */
  maxTokens?: number;
  /** Request JSON object response when supported by the provider. */
  jsonMode?: boolean;
  temperature?: number;
}

export interface AiCompletionResult {
  content: string;
  tokensUsed: number | null;
  provider: string;
  model: string;
}

/** Provider abstraction — add Anthropic/other implementations later without changing callers. */
export interface AiChatProvider {
  readonly name: string;
  readonly model: string;
  complete(messages: AiChatMessage[], options?: AiCompletionOptions): Promise<AiCompletionResult>;
}
