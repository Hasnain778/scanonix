"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Clipboard,
  ClipboardPaste,
  Copy,
  Download,
  Eraser,
  Share2,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ActionButton } from "@/components/ui/ActionButton";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { UpgradeRequiredNotice } from "@/components/plan/UsageBanner";
import { useUsageSummary } from "@/hooks/useUsageSummary";
import { LanguageCombobox } from "@/components/tools/ai-translate/LanguageCombobox";
import {
  AI_TRANSLATION_UNAVAILABLE,
  TRANSLATION_RATE_LIMIT,
  TRANSLATION_TOO_LONG,
} from "@/lib/ai/messages";
import { TRANSLATION_MAX_CHARACTERS } from "@/lib/ai/translation-languages";
import {
  AUTO_DETECT_LABEL,
  SOURCE_LANGUAGE_OPTIONS,
  TRANSLATION_LANGUAGES,
  isAutoDetect,
  isRtlLanguage,
} from "@/lib/ai/translation-languages";
import { formatPlanError } from "@/lib/plan/tool-gate";
import type { ToolStatus } from "@/lib/tools/types";

const TARGET_LANGUAGE_OPTIONS = TRANSLATION_LANGUAGES.map((language) => language.label);
const RECENT_STORAGE_KEY = "scanonix-translator-recent";
const PRIVACY_MESSAGE =
  "Text is sent securely for translation and is not stored on Scanonix servers. Your most recent translation is kept only in this browser.";

/** Shown when the browser session looks signed-in but the API returns 401. */
const SESSION_UNVERIFIED_MESSAGE =
  "Your session could not be verified. Refresh the page and try again.";

interface RecentTranslation {
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  translatedText: string;
  detectedLanguage?: string;
  savedAt: number;
}

interface TranslateApiResponse {
  translatedText?: string;
  detectedLanguage?: string;
  text?: string;
  error?: string;
  code?: string;
}

function formatTranslateError(
  data: TranslateApiResponse,
  status: number,
  clientAuthenticated: boolean,
): string {
  if (status === 401) {
    return clientAuthenticated
      ? SESSION_UNVERIFIED_MESSAGE
      : formatPlanError(data, status);
  }

  if (status === 429) return TRANSLATION_RATE_LIMIT;
  if (status === 503 || status === 502) return AI_TRANSLATION_UNAVAILABLE;
  if (data.error === TRANSLATION_TOO_LONG) return TRANSLATION_TOO_LONG;

  const planMessage = formatPlanError(data, status);
  if (planMessage !== "Could not authorize this operation.") {
    return planMessage;
  }

  if (data.error?.includes(".env") || data.error?.includes("OPENAI")) {
    return AI_TRANSLATION_UNAVAILABLE;
  }

  return data.error ?? AI_TRANSLATION_UNAVAILABLE;
}

function saveRecentTranslation(entry: RecentTranslation) {
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore storage failures.
  }
}

function loadRecentTranslation(): RecentTranslation | null {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RecentTranslation;
  } catch {
    return null;
  }
}

function panelTextDirection(language: string): "rtl" | "ltr" {
  return isRtlLanguage(language) ? "rtl" : "ltr";
}

export function AiTranslateTool() {
  const recentInitial = loadRecentTranslation();
  const { loading: authLoading, isAuthenticated } = useAuth();
  const {
    summary,
    loading: usageLoading,
    error: usageError,
  } = useUsageSummary();

  const [sourceLanguage, setSourceLanguage] = useState<string>(
    recentInitial?.sourceLanguage ?? AUTO_DETECT_LABEL,
  );
  const [targetLanguage, setTargetLanguage] = useState(
    recentInitial?.targetLanguage ?? "English",
  );
  const [sourceText, setSourceText] = useState(recentInitial?.sourceText ?? "");
  const [translatedText, setTranslatedText] = useState(recentInitial?.translatedText ?? "");
  const [detectedLanguage, setDetectedLanguage] = useState<string | undefined>(
    recentInitial?.detectedLanguage,
  );
  const [status, setStatus] = useState<ToolStatus>(
    recentInitial?.translatedText ? "success" : "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string>();
  const [copyFeedback, setCopyFeedback] = useState<string>();

  const authResolved = !authLoading;
  const usageResolved = !usageLoading;
  const stateResolved = authResolved && usageResolved;

  const premiumLocked =
    stateResolved && isAuthenticated && summary !== null && !summary.allowPremiumAi;
  const usageExhausted =
    stateResolved && isAuthenticated && summary !== null && summary.remaining <= 0;
  const unauthenticated = stateResolved && !isAuthenticated;
  const usageUnavailable =
    stateResolved && isAuthenticated && summary === null && Boolean(usageError);

  const isBusy = status === "loading";
  const charCount = sourceText.length;
  const overLimit = charCount > TRANSLATION_MAX_CHARACTERS;

  const effectiveSourceLanguage = useMemo(() => {
    if (isAutoDetect(sourceLanguage) && detectedLanguage) {
      return detectedLanguage;
    }
    return sourceLanguage;
  }, [sourceLanguage, detectedLanguage]);

  const canSwap =
    !isBusy &&
    !(isAutoDetect(sourceLanguage) && !detectedLanguage) &&
    Boolean(sourceText.trim() || translatedText.trim());

  const canTranslate =
    stateResolved &&
    isAuthenticated &&
    !usageUnavailable &&
    !premiumLocked &&
    !usageExhausted &&
    sourceText.trim().length > 0 &&
    !isBusy &&
    !overLimit;

  const handleTranslate = useCallback(async () => {
    if (!stateResolved || authLoading || usageLoading) {
      return;
    }

    if (!isAuthenticated) {
      setErrorMessage("Please sign in to use this tool.");
      setStatus("error");
      return;
    }

    if (!sourceText.trim()) {
      setErrorMessage("Please enter some text to translate.");
      setStatus("error");
      return;
    }

    if (overLimit) {
      setErrorMessage(TRANSLATION_TOO_LONG);
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage(undefined);
    setTranslatedText("");
    setDetectedLanguage(undefined);

    try {
      const response = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sourceText,
          sourceLanguage,
          targetLanguage,
        }),
      });

      const data = (await response.json()) as TranslateApiResponse;

      if (!response.ok) {
        setErrorMessage(formatTranslateError(data, response.status, isAuthenticated));
        setStatus("error");
        return;
      }

      const result = data.translatedText ?? data.text ?? "";
      setTranslatedText(result);
      setDetectedLanguage(data.detectedLanguage);
      setStatus("success");

      saveRecentTranslation({
        sourceLanguage,
        targetLanguage,
        sourceText,
        translatedText: result,
        detectedLanguage: data.detectedLanguage,
        savedAt: Date.now(),
      });
    } catch {
      setErrorMessage(AI_TRANSLATION_UNAVAILABLE);
      setStatus("error");
    }
  }, [
    authLoading,
    isAuthenticated,
    overLimit,
    sourceLanguage,
    sourceText,
    stateResolved,
    targetLanguage,
    usageLoading,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (canTranslate) {
          void handleTranslate();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canTranslate, handleTranslate]);

  async function copyText(text: string, label: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopyFeedback(`${label} copied`);
    setTimeout(() => setCopyFeedback(undefined), 2000);
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setSourceText(text);
    } catch {
      setErrorMessage("Unable to paste from clipboard.");
      setStatus("error");
    }
  }

  function handleClearSource() {
    setSourceText("");
    setTranslatedText("");
    setDetectedLanguage(undefined);
    setErrorMessage(undefined);
    setStatus("idle");
  }

  function handleReset() {
    setSourceLanguage(AUTO_DETECT_LABEL);
    setTargetLanguage("English");
    setSourceText("");
    setTranslatedText("");
    setDetectedLanguage(undefined);
    setErrorMessage(undefined);
    setStatus("idle");
    try {
      localStorage.removeItem(RECENT_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  function handleSwap() {
    if (!canSwap) return;

    const nextSource = targetLanguage;
    const nextTarget = isAutoDetect(sourceLanguage)
      ? detectedLanguage ?? targetLanguage
      : sourceLanguage;

    setSourceLanguage(nextSource);
    setTargetLanguage(nextTarget);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
    setDetectedLanguage(undefined);
    setErrorMessage(undefined);
    setStatus(translatedText.trim() ? "success" : "idle");
  }

  function handleDownload() {
    if (!translatedText) return;
    const blob = new Blob([translatedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `scanonix-translation-${targetLanguage.toLowerCase().replace(/\s+/g, "-")}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleShare() {
    if (!translatedText) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Scanonix translation",
          text: translatedText,
        });
      } catch {
        // User cancelled or share unavailable.
      }
      return;
    }
    await copyText(translatedText, "Translation");
  }

  const showStickyTranslate = Boolean(sourceText.trim());

  return (
    // pb/pr clear the global Find a Tool FAB on mobile/tablet (lg+ uses desktop FAB offset).
    <div className="space-y-5 overflow-x-hidden pb-28 lg:pb-0">
      {!stateResolved ? (
        <div className="rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-foreground-muted">
          Checking your account…
        </div>
      ) : null}

      {unauthenticated ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          Please{" "}
          <Link href="/login" className="font-semibold text-scanonix-orange hover:underline">
            sign in
          </Link>{" "}
          to use AI Translate.
        </div>
      ) : null}

      {usageUnavailable ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-foreground">
          Usage status could not be loaded. Refresh the page and try again.
        </div>
      ) : null}

      {premiumLocked ? <UpgradeRequiredNotice feature="Premium AI" /> : null}

      {usageExhausted ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-foreground">
          Limit reached.{" "}
          <Link href="/pricing" className="font-semibold text-scanonix-orange hover:underline">
            Upgrade your plan
          </Link>{" "}
          for more operations.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-foreground">
          {errorMessage}
        </div>
      ) : null}

      {copyFeedback ? (
        <div className="rounded-xl border border-scanonix-orange/30 bg-scanonix-orange/10 px-4 py-3 text-sm text-scanonix-orange">
          {copyFeedback}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
        {/* Desktop language bar — associated with both panes */}
        <div className="hidden border-b border-border px-4 py-4 sm:block sm:px-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <LanguageCombobox
              label="From"
              value={sourceLanguage}
              options={SOURCE_LANGUAGE_OPTIONS}
              onChange={setSourceLanguage}
              disabled={isBusy}
            />
            <button
              type="button"
              onClick={handleSwap}
              disabled={!canSwap}
              aria-label="Swap languages"
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-foreground-muted transition-colors hover:border-scanonix-orange/40 hover:text-scanonix-orange disabled:cursor-not-allowed disabled:opacity-40 sm:mb-0.5"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <LanguageCombobox
              label="To"
              value={targetLanguage}
              options={TARGET_LANGUAGE_OPTIONS}
              onChange={setTargetLanguage}
              disabled={isBusy}
            />
          </div>
        </div>

        {/* Dual panes */}
        <div className="grid lg:grid-cols-2">
          <div className="border-b border-border p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div className="mb-3 sm:hidden">
              <LanguageCombobox
                label="From"
                value={sourceLanguage}
                options={SOURCE_LANGUAGE_OPTIONS}
                onChange={setSourceLanguage}
                disabled={isBusy}
              />
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">Source text</p>
                {isAutoDetect(sourceLanguage) && detectedLanguage ? (
                  <p className="mt-1 text-xs text-scanonix-orange">Detected: {detectedLanguage}</p>
                ) : null}
              </div>
              <p className={`text-xs ${overLimit ? "text-red-700" : "text-foreground-muted"}`}>
                {charCount.toLocaleString()} / {TRANSLATION_MAX_CHARACTERS.toLocaleString()}
              </p>
            </div>

            <textarea
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="Enter text to translate…"
              disabled={isBusy}
              dir={panelTextDirection(effectiveSourceLanguage)}
              className="input-field min-h-[220px] w-full resize-y px-4 py-3 text-sm leading-relaxed"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handlePaste()}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-foreground-muted transition-colors hover:border-scanonix-orange/35 hover:text-foreground disabled:opacity-50"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                Paste
              </button>
              <button
                type="button"
                onClick={() => void copyText(sourceText, "Source")}
                disabled={!sourceText || isBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-foreground-muted transition-colors hover:border-scanonix-orange/35 hover:text-foreground disabled:opacity-50"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy source
              </button>
              <button
                type="button"
                onClick={handleClearSource}
                disabled={!sourceText || isBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-foreground-muted transition-colors hover:border-scanonix-orange/35 hover:text-foreground disabled:opacity-50"
              >
                <Eraser className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
          </div>

          <div className="flex justify-center border-b border-border py-2 sm:hidden">
            <button
              type="button"
              onClick={handleSwap}
              disabled={!canSwap}
              aria-label="Swap languages"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-foreground-muted transition-colors hover:border-scanonix-orange/40 hover:text-scanonix-orange disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 pr-24 sm:p-5 lg:pr-5">
            <div className="mb-3 sm:hidden">
              <LanguageCombobox
                label="To"
                value={targetLanguage}
                options={TARGET_LANGUAGE_OPTIONS}
                onChange={setTargetLanguage}
                disabled={isBusy}
              />
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Translation</p>
              {status === "success" && translatedText ? (
                <span className="text-xs text-scanonix-orange">Complete</span>
              ) : null}
            </div>

            <div
              dir={panelTextDirection(targetLanguage)}
              className="min-h-[220px] w-full rounded-xl border border-border bg-surface-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground"
            >
              {isBusy ? (
                <div className="flex h-full min-h-[188px] items-center justify-center text-foreground-muted">
                  Translating…
                </div>
              ) : translatedText ? (
                <div className="whitespace-pre-wrap">{translatedText}</div>
              ) : (
                <p className="text-foreground-muted">Your translation will appear here.</p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyText(translatedText, "Translation")}
                disabled={!translatedText || isBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-foreground-muted transition-colors hover:border-scanonix-orange/35 hover:text-foreground disabled:opacity-50"
              >
                <Clipboard className="h-3.5 w-3.5" />
                Copy result
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!translatedText || isBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-foreground-muted transition-colors hover:border-scanonix-orange/35 hover:text-foreground disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Download .txt
              </button>
              <button
                type="button"
                onClick={() => void handleShare()}
                disabled={!translatedText || isBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-foreground-muted transition-colors hover:border-scanonix-orange/35 hover:text-foreground disabled:opacity-50"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>
            </div>
          </div>
        </div>

        {/* Desktop CTAs — md+ only; sticky owns Translate below md */}
        <div className="hidden border-t border-border px-4 py-4 md:flex md:flex-row md:items-center md:justify-between md:px-5">
          <p className="text-xs text-foreground-muted">
            Press <kbd className="rounded border border-border px-1.5 py-0.5">Ctrl</kbd>+
            <kbd className="rounded border border-border px-1.5 py-0.5">Enter</kbd> to translate
          </p>
          <div className="flex flex-wrap gap-2">
            <ActionButton variant="outline" size="md" onClick={handleReset} disabled={isBusy}>
              Reset
            </ActionButton>
            <ActionButton
              size="md"
              loading={isBusy}
              disabled={!canTranslate}
              onClick={() => void handleTranslate()}
            >
              {isBusy ? "Translating…" : "Translate"}
            </ActionButton>
          </div>
        </div>

        {/* Mobile Reset only when sticky is not showing (empty source) */}
        {!showStickyTranslate ? (
          <div className="flex border-t border-border px-4 py-3 md:hidden">
            <ActionButton
              variant="outline"
              size="md"
              className="w-full"
              onClick={handleReset}
              disabled={isBusy}
            >
              Reset
            </ActionButton>
          </div>
        ) : null}
      </div>

      <PrivacyNotice message={PRIVACY_MESSAGE} />

      <ToolStickyMobileActionBar
        visible={showStickyTranslate}
        primaryLabel={isBusy ? "Translating…" : "Translate"}
        primaryLoading={isBusy}
        primaryDisabled={!canTranslate}
        onPrimaryClick={() => void handleTranslate()}
        secondaryLabel="Reset"
        onSecondaryClick={handleReset}
        secondaryDisabled={isBusy}
      />
    </div>
  );
}
