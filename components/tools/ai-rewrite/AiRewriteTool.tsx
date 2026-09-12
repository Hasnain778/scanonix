"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clipboard, Download } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PremiumAiToolGate } from "@/components/plan/PremiumAiToolGate";
import { UpgradeRequiredNotice } from "@/components/plan/UsageBanner";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ActionButton } from "@/components/ui/ActionButton";
import { useUsageSummary } from "@/hooks/useUsageSummary";
import { AI_REWRITE_UNAVAILABLE } from "@/lib/ai/messages";
import {
  REWRITE_LENGTHS,
  REWRITE_MAX_CHARACTERS,
  REWRITE_TONES,
  type RewriteLength,
  type RewriteTone,
} from "@/lib/ai/openai-server";
import {
  createProcessAttempt,
  httpStatusToErrorCode,
} from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";
import { formatPlanError } from "@/lib/plan/tool-gate";
import { downloadBlob } from "@/lib/tools/download";
import type { ToolStatus } from "@/lib/tools/types";

const PRIVACY_MESSAGE =
  "Text is sent to cloud AI for rewriting and is not stored after processing.";

const SESSION_UNVERIFIED_MESSAGE =
  "Your session could not be verified. Refresh the page and try again.";

const TONE_LABELS: Record<RewriteTone, string> = {
  professional: "Professional",
  friendly: "Friendly",
  formal: "Formal",
  concise: "Concise",
  persuasive: "Persuasive",
  simple: "Simple",
};

const LENGTH_LABELS: Record<RewriteLength, string> = {
  shorter: "Shorter",
  same: "Same length",
  longer: "Longer",
};

function formatRewriteError(
  data: { error?: string; code?: string },
  status: number,
  clientAuthenticated: boolean,
): string {
  if (status === 401) {
    return clientAuthenticated
      ? SESSION_UNVERIFIED_MESSAGE
      : formatPlanError(data, status);
  }

  if (status === 503 || status === 502) return AI_REWRITE_UNAVAILABLE;

  const planMessage = formatPlanError(data, status);
  if (planMessage !== "Could not authorize this operation.") {
    return planMessage;
  }

  if (data.error?.includes(".env") || data.error?.includes("OPENAI")) {
    return AI_REWRITE_UNAVAILABLE;
  }

  return data.error ?? AI_REWRITE_UNAVAILABLE;
}

export function AiRewriteTool() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const {
    summary,
    loading: usageLoading,
    error: usageError,
  } = useUsageSummary();

  const [inputText, setInputText] = useState("");
  const [tone, setTone] = useState<RewriteTone>("professional");
  const [length, setLength] = useState<RewriteLength>("same");
  const [preserveMeaning, setPreserveMeaning] = useState(true);
  const [outputText, setOutputText] = useState("");
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [copyFeedback, setCopyFeedback] = useState<string>();

  const authResolved = !authLoading;
  const usageResolved = !usageLoading;
  const stateResolved = authResolved && usageResolved;

  const premiumLocked =
    stateResolved && isAuthenticated && summary !== null && !summary.allowPremiumAi;
  const usageExhausted =
    stateResolved && isAuthenticated && summary !== null && summary.remaining <= 0;
  const usageUnavailable =
    stateResolved && isAuthenticated && summary === null && Boolean(usageError);

  const isBusy = status === "loading";
  const charCount = inputText.length;
  const overLimit = charCount > REWRITE_MAX_CHARACTERS;
  const hasResult = status === "success" && Boolean(outputText);

  const canRun =
    stateResolved &&
    isAuthenticated &&
    !usageUnavailable &&
    !premiumLocked &&
    !usageExhausted &&
    inputText.trim().length > 0 &&
    !isBusy &&
    !overLimit;

  const handleRewrite = useCallback(async () => {
    if (!stateResolved || authLoading || usageLoading) return;

    const attempt = createProcessAttempt("ai-rewrite");
    if (!attempt?.markStarted()) return;

    if (!isAuthenticated) {
      setErrorMessage("Please sign in to use this tool.");
      attempt.error("auth_required");
      setStatus("error");
      return;
    }

    if (!inputText.trim()) {
      setErrorMessage("Please enter some text to rewrite.");
      attempt.error("validation");
      setStatus("error");
      return;
    }

    if (overLimit) {
      setErrorMessage(
        `Text exceeds the ${REWRITE_MAX_CHARACTERS.toLocaleString()} character limit.`,
      );
      attempt.error("validation");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage(undefined);
    setOutputText("");

    try {
      const response = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, tone, length, preserveMeaning }),
      });
      const data = (await response.json()) as {
        text?: string;
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        setErrorMessage(formatRewriteError(data, response.status, isAuthenticated));
        attempt.error(httpStatusToErrorCode(response.status, data.code));
        setStatus("error");
        return;
      }

      setOutputText(data.text ?? "");
      attempt.success(1);
      setStatus("success");
    } catch {
      attempt.error("network");
      setErrorMessage(AI_REWRITE_UNAVAILABLE);
      setStatus("error");
    }
  }, [
    authLoading,
    inputText,
    isAuthenticated,
    length,
    overLimit,
    preserveMeaning,
    stateResolved,
    tone,
    usageLoading,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (canRun) void handleRewrite();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canRun, handleRewrite]);

  async function handleCopy() {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
    setCopyFeedback("Copied!");
    setTimeout(() => setCopyFeedback(undefined), 2000);
  }

  function handleDownload() {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, "rewritten-text.txt", buildToolDownloadMeta("ai-rewrite", 1));
  }

  function handleStartOver() {
    setInputText("");
    setOutputText("");
    setErrorMessage(undefined);
    setStatus("idle");
    setCopyFeedback(undefined);
  }

  const showSticky = Boolean(inputText.trim());

  return (
    <PremiumAiToolGate
      toolName="AI Rewrite"
      description="Sign in and upgrade to Scanonix Pro to use AI Rewrite. Free tools stay available without an account."
    >
      <div
        className={`space-y-5 overflow-x-hidden md:pb-0 ${
          hasResult ? "pb-40" : "pb-28"
        }`}
      >
        {!stateResolved ? (
          <div className="rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-foreground-muted">
            Checking your account…
          </div>
        ) : null}

        {premiumLocked ? <UpgradeRequiredNotice feature="AI Rewrite" /> : null}

        {usageUnavailable ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-foreground">
            Usage status could not be loaded. Refresh the page and try again.
          </div>
        ) : null}

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
          {/*
            Desktop: grid row stretches both panes to equal height.
            Each pane is flex-col so the editor/result surface flex-1 fills
            leftover space (avoids dead area under a short textarea).
            Mobile: stacked; panes do not force equal height.
          */}
          <div className="grid lg:grid-cols-2 lg:items-stretch">
            <div className="flex flex-col border-b border-border p-4 sm:p-5 lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r">
              <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="rewrite-input"
                  className="text-sm font-medium text-foreground"
                >
                  Source text
                </label>
                <p
                  className={`text-xs ${overLimit ? "text-red-700" : "text-foreground-muted"}`}
                >
                  {charCount.toLocaleString()} /{" "}
                  {REWRITE_MAX_CHARACTERS.toLocaleString()}
                </p>
              </div>
              <div className="relative min-h-[16rem] flex-1 lg:min-h-[22rem]">
                <textarea
                  id="rewrite-input"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  placeholder="Paste the text you want to improve or rewrite…"
                  disabled={isBusy}
                  maxLength={REWRITE_MAX_CHARACTERS}
                  className="input-field absolute inset-0 h-full w-full resize-y overflow-y-auto px-4 py-3 text-sm leading-relaxed lg:resize-none"
                />
              </div>
            </div>

            <div className="flex flex-col p-4 pr-24 sm:p-5 sm:pr-24 lg:h-full lg:min-h-0 lg:pr-5">
              <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Rewritten result</p>
                {hasResult ? (
                  <span className="text-xs text-scanonix-orange">Complete</span>
                ) : null}
              </div>
              <div className="min-h-[16rem] flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-surface-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground lg:min-h-[22rem]">
                {outputText ? (
                  outputText
                ) : (
                  <span className="text-foreground-muted">
                    Rewritten text will appear here…
                  </span>
                )}
              </div>

              {hasResult ? (
                <div className="mt-3 flex shrink-0 flex-wrap gap-2 pr-2 md:pr-0">
                  <ActionButton
                    size="md"
                    disabled={!outputText || isBusy}
                    onClick={() => void handleCopy()}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Clipboard className="h-3.5 w-3.5" />
                      {copyFeedback ?? "Copy"}
                    </span>
                  </ActionButton>
                  <ActionButton
                    variant="outline"
                    size="md"
                    disabled={!outputText || isBusy}
                    onClick={handleDownload}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Download className="h-3.5 w-3.5" />
                      Download .txt
                    </span>
                  </ActionButton>
                  <ActionButton
                    variant="outline"
                    size="md"
                    disabled={isBusy}
                    onClick={handleStartOver}
                  >
                    Start over
                  </ActionButton>
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t border-border px-4 py-4 sm:px-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label
                  className="mb-2 block text-sm font-medium text-foreground"
                  htmlFor="rewrite-tone"
                >
                  Tone
                </label>
                <select
                  id="rewrite-tone"
                  value={tone}
                  onChange={(event) => setTone(event.target.value as RewriteTone)}
                  disabled={isBusy}
                  className="select-field"
                >
                  {REWRITE_TONES.map((option) => (
                    <option key={option} value={option}>
                      {TONE_LABELS[option]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="mb-2 block text-sm font-medium text-foreground"
                  htmlFor="rewrite-length"
                >
                  Length
                </label>
                <select
                  id="rewrite-length"
                  value={length}
                  onChange={(event) => setLength(event.target.value as RewriteLength)}
                  disabled={isBusy}
                  className="select-field"
                >
                  {REWRITE_LENGTHS.map((option) => (
                    <option key={option} value={option}>
                      {LENGTH_LABELS[option]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end sm:col-span-2 lg:col-span-1">
                <label className="flex items-center gap-2 pb-2 text-sm text-foreground-muted">
                  <input
                    type="checkbox"
                    checked={preserveMeaning}
                    onChange={(event) => setPreserveMeaning(event.target.checked)}
                    disabled={isBusy}
                    className="accent-scanonix-orange"
                  />
                  Preserve original meaning and key facts
                </label>
              </div>
            </div>

            {/* Desktop/tablet primary: md+ only */}
            <div className="mt-4 hidden md:flex md:items-center md:justify-between">
              <p className="text-xs text-foreground-muted">
                Press <kbd className="rounded border border-border px-1.5 py-0.5">Ctrl</kbd>+
                <kbd className="rounded border border-border px-1.5 py-0.5">Enter</kbd> to
                rewrite
              </p>
              <ActionButton
                size="lg"
                className="shadow-[var(--shadow-orange-sm)]"
                loading={isBusy}
                disabled={!canRun}
                onClick={() => void handleRewrite()}
              >
                {isBusy ? "Rewriting…" : "Rewrite text"}
              </ActionButton>
            </div>
          </div>
        </div>

        {/* ToolFinder FAB shares this band — right pad keeps privacy readable */}
        <div
          className={`pr-24 sm:pr-36 lg:pr-0 ${
            hasResult ? "max-md:mb-8 max-md:pb-2" : ""
          }`}
        >
          <PrivacyNotice message={PRIVACY_MESSAGE} />
        </div>

        <ToolStickyMobileActionBar
          visible={showSticky}
          primaryLabel={isBusy ? "Rewriting…" : "Rewrite text"}
          primaryLoading={isBusy}
          primaryDisabled={!canRun}
          onPrimaryClick={() => void handleRewrite()}
        />
      </div>
    </PremiumAiToolGate>
  );
}
