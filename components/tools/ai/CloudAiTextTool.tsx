"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@/components/ui/ActionButton";
import { ToolResultsPanel } from "@/components/tools/ToolResultsPanel";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { PremiumAiToolGate } from "@/components/plan/PremiumAiToolGate";
import { UpgradeRequiredNotice } from "@/components/plan/UsageBanner";
import { useUsageSummary } from "@/hooks/useUsageSummary";
import {
  AI_SUMMARY_UNAVAILABLE,
  AI_TRANSLATION_UNAVAILABLE,
} from "@/lib/ai/messages";
import {
  createProcessAttempt,
  httpStatusToErrorCode,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { formatPlanError } from "@/lib/plan/tool-gate";
import type { ToolStatus } from "@/lib/tools/types";

interface CloudAiTextToolProps {
  mode: "summary" | "translate";
  actionLabel: string;
  inputLabel: string;
  inputPlaceholder: string;
  resultTitle: string;
  privacyNote: string;
}

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Arabic",
  "Hindi",
  "Chinese (Simplified)",
  "Japanese",
];

function formatAiToolError(
  mode: "summary" | "translate",
  data: { error?: string },
  status: number,
): string {
  if (status === 503 || status === 502) {
    return mode === "translate" ? AI_TRANSLATION_UNAVAILABLE : AI_SUMMARY_UNAVAILABLE;
  }

  const planMessage = formatPlanError(data, status);
  if (planMessage !== "Could not authorize this operation.") {
    return planMessage;
  }

  if (data.error?.includes(".env") || data.error?.includes("OPENAI")) {
    return mode === "translate" ? AI_TRANSLATION_UNAVAILABLE : AI_SUMMARY_UNAVAILABLE;
  }

  return data.error ?? (mode === "translate" ? AI_TRANSLATION_UNAVAILABLE : AI_SUMMARY_UNAVAILABLE);
}

export function CloudAiTextTool({
  mode,
  actionLabel,
  inputLabel,
  inputPlaceholder,
  resultTitle,
  privacyNote,
}: CloudAiTextToolProps) {
  const [inputText, setInputText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
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

  const toolSlug = mode === "summary" ? "ai-summary" : "ai-translate";

  const handleRun = useCallback(async () => {
    const attempt = createProcessAttempt(toolSlug);
    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setErrorMessage(undefined);
    setOutputText("");

    const endpoint = mode === "summary" ? "/api/ai/summary" : "/api/ai/translate";
    const payload =
      mode === "summary"
        ? { text: inputText }
        : { text: inputText, targetLanguage };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { text?: string; error?: string; code?: string };

      if (!response.ok) {
        setErrorMessage(formatAiToolError(mode, data, response.status));
        attempt.error(httpStatusToErrorCode(response.status, data.code));
        setStatus("error");
        return;
      }

      setOutputText(data.text ?? "");
      attempt.success(1);
      setStatus("success");
    } catch {
      attempt.error("network");
      setErrorMessage(
        mode === "translate" ? AI_TRANSLATION_UNAVAILABLE : AI_SUMMARY_UNAVAILABLE,
      );
      setStatus("error");
    }
  }, [inputText, mode, targetLanguage, toolSlug]);

  async function handleCopy() {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
    setCopyFeedback("Copied!");
    setTimeout(() => setCopyFeedback(undefined), 2000);
  }

  function handleStartOver() {
    setInputText("");
    setOutputText("");
    setErrorMessage(undefined);
    setStatus("idle");
  }

  const featureName = mode === "translate" ? "AI Translate" : "AI Summary";

  return (
    <PremiumAiToolGate
      toolName={featureName}
      description={`Sign in and upgrade to Scanonix Pro to use ${featureName}. Free tools stay available without an account.`}
    >
    <div className="space-y-6">
      {premiumLocked ? (
        <UpgradeRequiredNotice feature="Premium AI" />
      ) : null}

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
        <label className="mb-2 block text-sm font-medium text-neutral-300" htmlFor="ai-input">
          {inputLabel}
        </label>
        <textarea
          id="ai-input"
          rows={10}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={inputPlaceholder}
          disabled={isBusy}
          className="w-full resize-y rounded-xl border border-scanonix-border bg-black/40 px-4 py-3 text-sm text-white placeholder:text-scanonix-muted focus:border-scanonix-orange focus:outline-none focus:ring-1 focus:ring-scanonix-orange"
        />

        {mode === "translate" && (
          <div className="mt-4">
            <label
              className="mb-2 block text-sm font-medium text-neutral-300"
              htmlFor="target-language"
            >
              Target language
            </label>
            <select
              id="target-language"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              disabled={isBusy}
              className="w-full rounded-xl border border-scanonix-border bg-black/40 px-4 py-3 text-sm text-white focus:border-scanonix-orange focus:outline-none focus:ring-1 focus:ring-scanonix-orange"
            >
              {LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-5 hidden sm:block">
          <ActionButton
            size="lg"
            loading={isBusy}
            disabled={!canRun}
            onClick={() => void handleRun()}
          >
            {actionLabel}
          </ActionButton>
        </div>
      </div>

      <PrivacyNotice message={privacyNote} />

      {(status === "success" || status === "error") && (
        <ToolResultsPanel
          title={resultTitle}
          primaryLabel={copyFeedback ?? "Copy result"}
          onPrimaryClick={() => void handleCopy()}
          primaryDisabled={!outputText}
          onStartOver={handleStartOver}
        >
          {status === "error" && errorMessage && (
            <p className="mb-3 text-sm text-red-400">{errorMessage}</p>
          )}
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
        primaryLabel={actionLabel}
        primaryLoading={isBusy}
        primaryDisabled={!canRun}
        onPrimaryClick={() => void handleRun()}
      />
    </div>
    </PremiumAiToolGate>
  );
}
