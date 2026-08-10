import { isOpenAiConfigured } from "@/config/env";
import { AI_SERVICE_UNAVAILABLE, TRANSLATION_EMPTY, TRANSLATION_TOO_LONG } from "@/lib/ai/messages";
import {
  AUTO_DETECT_LABEL,
  isAutoDetect,
  isValidSourceLanguage,
  isValidTargetLanguage,
  TRANSLATION_MAX_CHARACTERS,
} from "@/lib/ai/translation-languages";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
export { TRANSLATION_MAX_CHARACTERS };

export class OpenAiError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly code?: "service_unavailable",
  ) {
    super(message);
    this.name = "OpenAiError";
  }
}

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new OpenAiError(AI_SERVICE_UNAVAILABLE, 503, "service_unavailable");
  }
  return key;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  if (!isOpenAiConfigured()) {
    throw new OpenAiError(AI_SERVICE_UNAVAILABLE, 503, "service_unavailable");
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new OpenAiError(
      AI_SERVICE_UNAVAILABLE,
      response.status >= 500 ? 503 : 502,
      "service_unavailable",
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new OpenAiError("OpenAI returned an empty response.", 502);
  }

  return text;
}

export async function summarizeText(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new OpenAiError("Text is required.", 400);
  }
  if (trimmed.length > 100_000) {
    throw new OpenAiError("Text exceeds the 100,000 character limit.", 400);
  }

  return chatCompletion([
    {
      role: "system",
      content:
        "You are a document assistant for Scanonix. Summarize the user's text clearly in British English. Use concise paragraphs and bullet points when helpful.",
    },
    { role: "user", content: trimmed },
  ]);
}

async function chatCompletionJson(messages: ChatMessage[]): Promise<string> {
  if (!isOpenAiConfigured()) {
    throw new OpenAiError(AI_SERVICE_UNAVAILABLE, 503, "service_unavailable");
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new OpenAiError(
      AI_SERVICE_UNAVAILABLE,
      response.status >= 500 ? 503 : 502,
      "service_unavailable",
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new OpenAiError("OpenAI returned an empty response.", 502);
  }

  return text;
}

export interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
}

const TRANSLATION_RULES = `
- Translate accurately and naturally
- Preserve meaning, tone, names, numbers and formatting
- Do not summarize
- Do not explain
- Return only the translation in translatedText
- Preserve paragraphs and line breaks
- Keep URLs, email addresses and codes unchanged
- Correctly handle formal and informal text
- Support right-to-left languages`.trim();

function parseTranslationJson(raw: string): TranslationResult {
  try {
    const parsed = JSON.parse(raw) as {
      translatedText?: string;
      detectedLanguage?: string;
    };
    const translatedText = parsed.translatedText?.trim();
    if (!translatedText) {
      throw new Error("Missing translatedText");
    }
    return {
      translatedText,
      detectedLanguage: parsed.detectedLanguage?.trim() || undefined,
    };
  } catch {
    throw new OpenAiError(AI_SERVICE_UNAVAILABLE, 502, "service_unavailable");
  }
}

export async function translateTextAdvanced(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<TranslationResult> {
  const trimmed = text.trim();
  const source = sourceLanguage.trim();
  const target = targetLanguage.trim();

  if (!trimmed) {
    throw new OpenAiError(TRANSLATION_EMPTY, 400);
  }
  if (!isValidSourceLanguage(source)) {
    throw new OpenAiError("Invalid source language.", 400);
  }
  if (!isValidTargetLanguage(target)) {
    throw new OpenAiError("Invalid target language.", 400);
  }
  if (trimmed.length > TRANSLATION_MAX_CHARACTERS) {
    throw new OpenAiError(TRANSLATION_TOO_LONG, 400);
  }

  const autoDetect = isAutoDetect(source);

  const systemPrompt = autoDetect
    ? `You are a professional translator for Scanonix. Detect the source language of the user's text and translate it into ${target}.

Respond with JSON only using this shape:
{"translatedText":"...","detectedLanguage":"..."}

Rules:
${TRANSLATION_RULES}
- detectedLanguage must be the full language name in English (e.g. "Urdu")`
    : `You are a professional translator for Scanonix. Translate from ${source} to ${target}.

Respond with JSON only using this shape:
{"translatedText":"..."}

Rules:
${TRANSLATION_RULES}`;

  const raw = await chatCompletionJson([
    { role: "system", content: systemPrompt },
    { role: "user", content: trimmed },
  ]);

  const result = parseTranslationJson(raw);

  if (autoDetect && !result.detectedLanguage) {
    throw new OpenAiError(AI_SERVICE_UNAVAILABLE, 502, "service_unavailable");
  }

  return result;
}

export async function translateText(
  text: string,
  targetLanguage: string,
): Promise<string> {
  const result = await translateTextAdvanced(text, AUTO_DETECT_LABEL, targetLanguage);
  return result.translatedText;
}

export const REWRITE_TONES = [
  "professional",
  "friendly",
  "formal",
  "concise",
  "persuasive",
  "simple",
] as const;

export const REWRITE_LENGTHS = ["shorter", "same", "longer"] as const;

export type RewriteTone = (typeof REWRITE_TONES)[number];
export type RewriteLength = (typeof REWRITE_LENGTHS)[number];

export const REWRITE_MAX_CHARACTERS = 12_000;

const TONE_LABELS: Record<RewriteTone, string> = {
  professional: "professional and polished",
  friendly: "warm and friendly",
  formal: "formal and precise",
  concise: "concise and direct",
  persuasive: "persuasive and compelling",
  simple: "simple and easy to understand",
};

const LENGTH_INSTRUCTIONS: Record<RewriteLength, string> = {
  shorter: "Make the rewrite noticeably shorter while keeping the key points.",
  same: "Keep a similar length to the original.",
  longer: "Expand the rewrite with more detail while staying on topic.",
};

export function isValidRewriteTone(value: string): value is RewriteTone {
  return (REWRITE_TONES as readonly string[]).includes(value);
}

export function isValidRewriteLength(value: string): value is RewriteLength {
  return (REWRITE_LENGTHS as readonly string[]).includes(value);
}

export async function rewriteText(
  text: string,
  tone: RewriteTone,
  length: RewriteLength,
  preserveMeaning = true,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new OpenAiError("Text is required.", 400);
  }
  if (trimmed.length > REWRITE_MAX_CHARACTERS) {
    throw new OpenAiError(
      `Text exceeds the ${REWRITE_MAX_CHARACTERS.toLocaleString()} character limit.`,
      400,
    );
  }

  const meaningRule = preserveMeaning
    ? "Preserve the original meaning and key facts exactly."
    : "You may lightly improve clarity while keeping the core message.";

  return chatCompletion([
    {
      role: "system",
      content: `You are a writing assistant for Scanonix. Rewrite the user's text in a ${TONE_LABELS[tone]} tone. ${LENGTH_INSTRUCTIONS[length]} ${meaningRule} Use British English. Return only the rewritten text with no preamble or explanation.`,
    },
    { role: "user", content: trimmed },
  ]);
}
