"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clipboard, ClipboardPaste, Eraser, FileText, Upload } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PremiumAiToolGate } from "@/components/plan/PremiumAiToolGate";
import { UpgradeRequiredNotice } from "@/components/plan/UsageBanner";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ActionButton } from "@/components/ui/ActionButton";
import { useUsageSummary } from "@/hooks/useUsageSummary";
import { AI_SUMMARY_UNAVAILABLE } from "@/lib/ai/messages";
import {
  createProcessAttempt,
  httpStatusToErrorCode,
} from "@/lib/analytics/process-lifecycle";
import { getAnonymousUploadLimit } from "@/lib/plan/tool-access";
import { formatPlanError } from "@/lib/plan/tool-gate";
import {
  detectSummaryDocumentKind,
  extractSummaryDocumentText,
  formatSummaryDocumentKind,
  SUMMARY_OCR_TOOL_HREF,
  SUMMARY_UPLOAD_ACCEPT,
  SummaryDocumentExtractError,
  validateSummaryUploadFile,
  type SummaryDocumentKind,
} from "@/lib/tools/ai-summary/extract-document-text";
import { formatFileSize } from "@/lib/tools/format-utils";
import type { ToolStatus } from "@/lib/tools/types";

const SUMMARY_MAX_CHARACTERS = 100_000;
const PRIVACY_MESSAGE =
  "Document text is extracted in your browser when you upload a file. Extracted or pasted text is sent securely to the AI provider only when you press Generate summary. Avoid confidential content unless your organisation permits cloud AI processing.";
const SESSION_UNVERIFIED_MESSAGE =
  "Your session could not be verified. Refresh the page and try again.";
const OVER_LIMIT_MESSAGE =
  "This document contains more than 100,000 characters. Shorten the text before generating a summary.";

type InputSource = "upload" | "paste";
type ExtractionStatus = "idle" | "extracting" | "ready" | "error";

interface UploadedSummaryFile {
  file: File;
  kind: SummaryDocumentKind;
}

function formatSummaryError(
  data: { error?: string; code?: string },
  status: number,
  clientAuthenticated: boolean,
): string {
  if (status === 401) {
    return clientAuthenticated
      ? SESSION_UNVERIFIED_MESSAGE
      : formatPlanError(data, status);
  }

  if (status === 503 || status === 502) return AI_SUMMARY_UNAVAILABLE;

  const planMessage = formatPlanError(data, status);
  if (planMessage !== "Could not authorize this operation.") {
    return planMessage;
  }

  if (data.error?.includes(".env") || data.error?.includes("OPENAI")) {
    return AI_SUMMARY_UNAVAILABLE;
  }

  return data.error ?? AI_SUMMARY_UNAVAILABLE;
}

function DocumentDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <Upload className={className} aria-hidden="true" strokeWidth={1.75} />;
}

export function AiSummaryTool() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const {
    summary,
    loading: usageLoading,
    error: usageError,
  } = useUsageSummary();

  const [inputSource, setInputSource] = useState<InputSource>("upload");
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [copyFeedback, setCopyFeedback] = useState<string>();
  const [uploaded, setUploaded] = useState<UploadedSummaryFile | null>(null);
  const [extractionStatus, setExtractionStatus] =
    useState<ExtractionStatus>("idle");

  const maxUploadBytes = summary?.maxUploadBytes ?? getAnonymousUploadLimit();

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
  const isExtracting = extractionStatus === "extracting";
  const charCount = inputText.length;
  const overLimit = charCount > SUMMARY_MAX_CHARACTERS;
  const hasResult = status === "success" && Boolean(outputText);

  const canRun =
    stateResolved &&
    isAuthenticated &&
    !usageUnavailable &&
    !premiumLocked &&
    !usageExhausted &&
    inputText.trim().length > 0 &&
    !isBusy &&
    !isExtracting &&
    !overLimit;

  const extractionLabel = useMemo(() => {
    switch (extractionStatus) {
      case "extracting":
        return "Extracting text…";
      case "ready":
        return "Text extracted — review before summarising";
      case "error":
        return "Extraction failed";
      default:
        return null;
    }
  }, [extractionStatus]);

  const handleGenerate = useCallback(async () => {
    if (!stateResolved || authLoading || usageLoading || isExtracting) return;

    const attempt = createProcessAttempt("ai-summary");
    if (!attempt?.markStarted()) return;

    if (!isAuthenticated) {
      setErrorMessage("Please sign in to use this tool.");
      attempt.error("auth_required");
      setStatus("error");
      return;
    }

    if (!inputText.trim()) {
      setErrorMessage("Please enter some text to summarise.");
      attempt.error("validation");
      setStatus("error");
      return;
    }

    if (overLimit) {
      setErrorMessage(OVER_LIMIT_MESSAGE);
      attempt.error("validation");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage(undefined);
    setOutputText("");

    try {
      const response = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });
      const data = (await response.json()) as {
        text?: string;
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        setErrorMessage(formatSummaryError(data, response.status, isAuthenticated));
        attempt.error(httpStatusToErrorCode(response.status, data.code));
        setStatus("error");
        return;
      }

      setOutputText(data.text ?? "");
      attempt.success(1);
      setStatus("success");
    } catch {
      attempt.error("network");
      setErrorMessage(AI_SUMMARY_UNAVAILABLE);
      setStatus("error");
    }
  }, [
    authLoading,
    inputText,
    isAuthenticated,
    isExtracting,
    overLimit,
    stateResolved,
    usageLoading,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (canRun) void handleGenerate();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canRun, handleGenerate]);

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setInputText(text);
    } catch {
      setErrorMessage("Unable to paste from clipboard.");
      setStatus("error");
    }
  }

  async function handleCopy() {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
    setCopyFeedback("Copied!");
    setTimeout(() => setCopyFeedback(undefined), 2000);
  }

  function handleClearText() {
    setInputText("");
    setErrorMessage(undefined);
    if (status === "error") setStatus("idle");
  }

  function handleClearUpload() {
    setUploaded(null);
    setExtractionStatus("idle");
    setErrorMessage(undefined);
    if (status === "error") setStatus("idle");
  }

  function handleStartOver() {
    setInputText("");
    setOutputText("");
    setErrorMessage(undefined);
    setStatus("idle");
    setUploaded(null);
    setExtractionStatus("idle");
    setCopyFeedback(undefined);
  }

  function switchSource(next: InputSource) {
    if (next === inputSource) return;
    setInputSource(next);
    setErrorMessage(undefined);
    if (status === "error") setStatus("idle");
  }

  async function processUploadFile(file: File) {
    const validationError = validateSummaryUploadFile(file, maxUploadBytes);
    if (validationError) {
      setUploaded(null);
      setExtractionStatus("error");
      setErrorMessage(validationError.message);
      setStatus("error");
      return;
    }

    const detected = detectSummaryDocumentKind(file);
    if (!detected) return;

    setUploaded({ file, kind: detected });
    setExtractionStatus("extracting");
    setErrorMessage(undefined);
    setOutputText("");
    if (status === "success") setStatus("idle");

    try {
      const result = await extractSummaryDocumentText(file);
      setInputText(result.text);
      setExtractionStatus("ready");
      setStatus("idle");
    } catch (error) {
      setExtractionStatus("error");
      setStatus("error");
      if (error instanceof SummaryDocumentExtractError) {
        setErrorMessage(error.message);
        return;
      }
      setErrorMessage("Could not extract text from this document.");
    }
  }

  function handleFilesSelected(files: File[]) {
    const file = files[0];
    if (!file || isBusy || isExtracting) return;
    void processUploadFile(file);
  }

  function handleInvalidFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    const validationError = validateSummaryUploadFile(file, maxUploadBytes);
    setUploaded(null);
    setExtractionStatus("error");
    setErrorMessage(
      validationError?.message ??
        "Unsupported file type. Upload a PDF, DOCX, or TXT file.",
    );
    setStatus("error");
  }

  const showSticky = Boolean(inputText.trim()) || Boolean(uploaded);

  return (
    <PremiumAiToolGate
      toolName="AI Summary"
      description="Sign in and upgrade to Scanonix Pro to use AI Summary. Free tools stay available without an account."
    >
      {/* Mobile bottom pad clears sticky CTA + ToolFinder FAB; md+ uses in-workspace CTAs */}
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

        {premiumLocked ? <UpgradeRequiredNotice feature="Premium AI" /> : null}

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
            <p>{errorMessage}</p>
            {(errorMessage.includes("OCR") ||
              errorMessage.includes("scanned") ||
              errorMessage.includes("Images aren't supported")) && (
              <p className="mt-2">
                <Link
                  href={SUMMARY_OCR_TOOL_HREF}
                  className="font-semibold text-scanonix-orange hover:underline"
                >
                  Open Scanonix OCR
                </Link>
              </p>
            )}
          </div>
        ) : null}

        {copyFeedback ? (
          <div className="rounded-xl border border-scanonix-orange/30 bg-scanonix-orange/10 px-4 py-3 text-sm text-scanonix-orange">
            {copyFeedback}
          </div>
        ) : null}

        {!hasResult ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
            <div className="border-b border-border px-4 py-3 sm:px-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                Input source
              </p>
              <div
                className="inline-flex rounded-xl border border-border bg-surface-muted/50 p-1"
                role="group"
                aria-label="Choose input source"
              >
                <button
                  type="button"
                  onClick={() => switchSource("upload")}
                  disabled={isBusy || isExtracting}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 sm:px-4 ${
                    inputSource === "upload"
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  Upload document
                </button>
                <button
                  type="button"
                  onClick={() => switchSource("paste")}
                  disabled={isBusy || isExtracting}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 sm:px-4 ${
                    inputSource === "paste"
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  Paste text
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {inputSource === "upload" ? (
                <div className="space-y-4">
                  {!uploaded ? (
                    <div className="space-y-2">
                      <FileDropZone
                        multiple={false}
                        accept={SUMMARY_UPLOAD_ACCEPT}
                        label="Upload a document"
                        hint="Drop PDF, DOCX or TXT here — or browse"
                        disabled={isBusy || isExtracting}
                        onFilesSelected={handleFilesSelected}
                        onInvalidFiles={handleInvalidFiles}
                        validateFile={(file) =>
                          validateSummaryUploadFile(file, maxUploadBytes) === null
                        }
                        icon={<DocumentDropIcon />}
                        className="!p-8 sm:!p-10"
                      />
                      <p className="text-center text-xs text-foreground-muted">
                        PDF · DOCX · TXT
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-surface-muted/40 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-0.5 rounded-lg border border-border bg-surface p-2 text-foreground-muted">
                            <FileText className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {uploaded.file.name}
                            </p>
                            <p className="mt-0.5 text-xs text-foreground-muted">
                              {formatSummaryDocumentKind(uploaded.kind)} ·{" "}
                              {formatFileSize(uploaded.file.size)}
                            </p>
                            {extractionLabel ? (
                              <p
                                className={`mt-1 text-xs ${
                                  extractionStatus === "error"
                                    ? "text-red-700"
                                    : extractionStatus === "ready"
                                      ? "text-scanonix-orange"
                                      : "text-foreground-muted"
                                }`}
                              >
                                {extractionLabel}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearUpload}
                          disabled={isBusy || isExtracting}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:border-scanonix-orange/35 hover:text-foreground disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                      <p className="mt-3 text-xs text-foreground-muted">
                        PDF · DOCX · TXT · Scanned PDFs: use{" "}
                        <Link
                          href={SUMMARY_OCR_TOOL_HREF}
                          className="font-medium text-scanonix-orange hover:underline"
                        >
                          OCR
                        </Link>
                      </p>
                    </div>
                  )}

                  {(uploaded || inputText) && (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label
                          htmlFor="ai-summary-input"
                          className="text-sm font-medium text-foreground"
                        >
                          Document text
                        </label>
                        <p
                          className={`text-xs ${overLimit ? "text-red-700" : "text-foreground-muted"}`}
                        >
                          {charCount.toLocaleString()} /{" "}
                          {SUMMARY_MAX_CHARACTERS.toLocaleString()}
                        </p>
                      </div>

                      {overLimit ? (
                        <p className="text-xs text-red-700">{OVER_LIMIT_MESSAGE}</p>
                      ) : null}

                      <textarea
                        id="ai-summary-input"
                        value={inputText}
                        onChange={(event) => setInputText(event.target.value)}
                        placeholder={
                          isExtracting
                            ? "Extracting text…"
                            : "Extracted text appears here — review or edit before summarising…"
                        }
                        disabled={isBusy || isExtracting}
                        className="input-field min-h-[220px] w-full resize-y px-4 py-3 text-sm leading-relaxed"
                      />
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="ai-summary-input-paste"
                      className="text-sm font-medium text-foreground"
                    >
                      Document text
                    </label>
                    <p
                      className={`text-xs ${overLimit ? "text-red-700" : "text-foreground-muted"}`}
                    >
                      {charCount.toLocaleString()} /{" "}
                      {SUMMARY_MAX_CHARACTERS.toLocaleString()}
                    </p>
                  </div>

                  {overLimit ? (
                    <p className="mb-2 text-xs text-red-700">{OVER_LIMIT_MESSAGE}</p>
                  ) : null}

                  <textarea
                    id="ai-summary-input-paste"
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    placeholder="Paste or type document text to summarise…"
                    disabled={isBusy}
                    className="input-field min-h-[240px] w-full resize-y px-4 py-3 text-sm leading-relaxed"
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
                      onClick={handleClearText}
                      disabled={!inputText || isBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-foreground-muted transition-colors hover:border-scanonix-orange/35 hover:text-foreground disabled:opacity-50"
                    >
                      <Eraser className="h-3.5 w-3.5" />
                      Clear
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Desktop/tablet primary: md+ only */}
            <div className="hidden border-t border-border px-4 py-4 md:flex md:items-center md:justify-between md:px-5">
              <p className="text-xs text-foreground-muted">
                Press <kbd className="rounded border border-border px-1.5 py-0.5">Ctrl</kbd>+
                <kbd className="rounded border border-border px-1.5 py-0.5">Enter</kbd> to
                summarise
              </p>
              <ActionButton
                size="lg"
                className="shadow-[var(--shadow-orange-sm)]"
                loading={isBusy}
                disabled={!canRun}
                onClick={() => void handleGenerate()}
              >
                {isBusy ? "Summarising…" : "Generate summary"}
              </ActionButton>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
            <div className="grid lg:grid-cols-2">
              <div className="border-b border-border p-4 sm:p-5 lg:border-b-0 lg:border-r">
                <p className="mb-3 text-sm font-medium text-foreground">Document text</p>
                <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-surface-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground">
                  {inputText}
                </div>
              </div>

              {/* pr-24 through <lg keeps Copy / Start over clear of ToolFinder FAB */}
              <div className="p-4 pr-24 sm:p-5 sm:pr-24 lg:pr-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">Summary</p>
                  <span className="text-xs text-scanonix-orange">Complete</span>
                </div>
                <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-surface-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground">
                  {outputText}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 pr-2 md:pr-0">
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
                    disabled={isBusy}
                    onClick={handleStartOver}
                  >
                    Start over
                  </ActionButton>
                </div>
              </div>
            </div>

            <div className="hidden border-t border-border px-4 py-4 md:flex md:justify-end md:px-5">
              <ActionButton
                size="lg"
                loading={isBusy}
                disabled={!canRun}
                onClick={() => void handleGenerate()}
              >
                {isBusy ? "Summarising…" : "Generate again"}
              </ActionButton>
            </div>
          </div>
        )}

        {/*
          ToolFinder FAB is fixed right-4/sm:right-6 and lifts above the sticky CTA,
          so it shares the privacy vertical band. Right pad (not extra bottom pad)
          keeps privacy copy out from under the FAB through <lg.
        */}
        <div
          className={`pr-24 sm:pr-36 lg:pr-0 ${
            hasResult ? "max-md:mb-8 max-md:pb-2" : ""
          }`}
        >
          <PrivacyNotice message={PRIVACY_MESSAGE} />
        </div>

        <ToolStickyMobileActionBar
          visible={showSticky}
          primaryLabel={
            isBusy
              ? "Summarising…"
              : hasResult
                ? "Generate again"
                : "Generate summary"
          }
          primaryLoading={isBusy}
          primaryDisabled={!canRun}
          onPrimaryClick={() => void handleGenerate()}
        />
      </div>
    </PremiumAiToolGate>
  );
}
