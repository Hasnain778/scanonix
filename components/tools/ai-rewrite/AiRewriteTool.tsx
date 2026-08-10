"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@/components/ui/ActionButton";
import { PremiumAiToolGate } from "@/components/plan/PremiumAiToolGate";
import { UpgradeRequiredNotice } from "@/components/plan/UsageBanner";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolResultsPanel } from "@/components/tools/ToolResultsPanel";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { useUsageSummary } from "@/hooks/useUsageSummary";
import { AI_REWRITE_UNAVAILABLE } from "@/lib/ai/messages";
import {
  REWRITE_LENGTHS,
  REWRITE_MAX_CHARACTERS,
  REWRITE_TONES,
  type RewriteLength,
  type RewriteTone,
} from "@/lib/ai/openai-server";
import { formatPlanError } from "@/lib/plan/tool-gate";
import { downloadBlob } from "@/lib/tools/download";
import type { ToolStatus } from "@/lib/tools/types";

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

function formatRewriteError(data: { error?: string; code?: string }, status: number): string {
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
  const [inputText, setInputText] = useState("");
  const [tone, setTone] = useState<RewriteTone>("professional");
  const [length, setLength] = useState<RewriteLength>("same");
  const [preserveMeaning, setPreserveMeaning] = useState(true);
  const [outputText, setOutputText] = useState("");
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [copyFeedback, setCopyFeedback] = useState<string>();
  const { summary } = useUsageSummary();

  const premiumLocked = summary !== null && !summary.allowPremiumAi;
  const usageExhausted = summary !== null && summary.remaining <= 0;
  const isBusy = status === "loading";
  const canRun =
    inputText.trim().length > 0 && !isBusy && !premiumLocked && !usageExhausted;

  const handleRewrite = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(undefined);
    setOutputText("");

    try {
      const response = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, tone, length, preserveMeaning }),
      });
      const data = (await response.json()) as { text?: string; error?: string; code?: string };

      if (!response.ok) {
        setErrorMessage(formatRewriteError(data, response.status));
        setStatus("error");
        return;
      }

      setOutputText(data.text ?? "");
      setStatus("success");
    } catch {
      setErrorMessage(AI_REWRITE_UNAVAILABLE);
      setStatus("error");
    }
  }, [inputText, length, preserveMeaning, tone]);

  async function handleCopy() {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
    setCopyFeedback("Copied!");
    setTimeout(() => setCopyFeedback(undefined), 2000);
  }

  function handleDownload() {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, "rewritten-text.txt");
  }

  function handleStartOver() {
    setInputText("");
    setOutputText("");
    setErrorMessage(undefined);
    setStatus("idle");
  }

  return (
    <PremiumAiToolGate toolName="AI Rewrite">
    <div className="space-y-6">
      {premiumLocked ? <UpgradeRequiredNotice feature="AI Rewrite" /> : null}

      {usageExhausted ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Limit reached.{" "}
          <Link href="/pricing" className="font-semibold text-scanonix-orange hover:underline">
            Upgrade your plan
          </Link>{" "}
          for more operations.
        </div>
      ) : null}

      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <label className="mb-2 block text-sm font-medium text-neutral-300" htmlFor="rewrite-input">
          Text to rewrite
        </label>
        <textarea
          id="rewrite-input"
          rows={10}
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder="Paste the text you want to improve or rewrite…"
          disabled={isBusy}
          maxLength={REWRITE_MAX_CHARACTERS}
          className="w-full resize-y rounded-xl border border-scanonix-border bg-black/40 px-4 py-3 text-sm text-white placeholder:text-scanonix-muted focus:border-scanonix-orange focus:outline-none focus:ring-1 focus:ring-scanonix-orange"
        />
        <p className="mt-2 text-xs text-scanonix-muted">
          {inputText.length.toLocaleString()} / {REWRITE_MAX_CHARACTERS.toLocaleString()} characters
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-300" htmlFor="rewrite-tone">
              Tone
            </label>
            <select
              id="rewrite-tone"
              value={tone}
              onChange={(event) => setTone(event.target.value as RewriteTone)}
              disabled={isBusy}
              className="w-full rounded-xl border border-scanonix-border bg-black/40 px-4 py-3 text-sm text-white focus:border-scanonix-orange focus:outline-none focus:ring-1 focus:ring-scanonix-orange"
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
              className="mb-2 block text-sm font-medium text-neutral-300"
              htmlFor="rewrite-length"
            >
              Length
            </label>
            <select
              id="rewrite-length"
              value={length}
              onChange={(event) => setLength(event.target.value as RewriteLength)}
              disabled={isBusy}
              className="w-full rounded-xl border border-scanonix-border bg-black/40 px-4 py-3 text-sm text-white focus:border-scanonix-orange focus:outline-none focus:ring-1 focus:ring-scanonix-orange"
            >
              {REWRITE_LENGTHS.map((option) => (
                <option key={option} value={option}>
                  {LENGTH_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-scanonix-muted">
          <input
            type="checkbox"
            checked={preserveMeaning}
            onChange={(event) => setPreserveMeaning(event.target.checked)}
            disabled={isBusy}
            className="accent-scanonix-orange"
          />
          Preserve original meaning and key facts
        </label>

        <div className="mt-5 hidden sm:block">
          <ActionButton
            size="lg"
            loading={isBusy}
            disabled={!canRun}
            onClick={() => void handleRewrite()}
          >
            Rewrite text
          </ActionButton>
        </div>
      </div>

      <PrivacyNotice message="Text is sent to cloud AI for rewriting and is not stored after processing." />

      {(status === "success" || status === "error") && (
        <ToolResultsPanel
          title="Rewritten text"
          primaryLabel={copyFeedback ?? "Copy result"}
          onPrimaryClick={() => void handleCopy()}
          primaryDisabled={!outputText}
          secondaryLabel="Download .txt"
          onSecondaryClick={handleDownload}
          secondaryDisabled={!outputText}
          onStartOver={handleStartOver}
        >
          {status === "error" && errorMessage ? (
            <p className="mb-3 text-sm text-red-400">{errorMessage}</p>
          ) : null}
          {outputText ? (
            <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-scanonix-border bg-black/30 p-4 text-sm leading-relaxed text-neutral-200">
              {outputText}
            </div>
          ) : (
            status === "success" && (
              <p className="text-sm text-scanonix-muted">No output returned.</p>
            )
          )}
        </ToolResultsPanel>
      )}

      <ToolStickyMobileActionBar
        visible={Boolean(inputText.trim())}
        primaryLabel="Rewrite text"
        primaryLoading={isBusy}
        primaryDisabled={!canRun}
        onPrimaryClick={() => void handleRewrite()}
      />
    </div>
    </PremiumAiToolGate>
  );
}
