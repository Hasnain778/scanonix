"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateDeterministicAssistantResponse } from "@/lib/ai/scan-assistant/fallback";
import { buildScanAssistantContext } from "@/lib/ai/scan-assistant/build-context";
import { getSuggestedQuestions } from "@/lib/ai/scan-assistant/suggested-questions";
import type { ScanAssistantMessage } from "@/lib/ai/scan-assistant/types";
import { formatPlanError } from "@/lib/plan/tool-gate";
import type { ScanReport } from "@/lib/scan-report/types";

interface ScanAssistantPanelProps {
  report: ScanReport;
  isDemo?: boolean;
}

export function ScanAssistantPanel({ report, isDemo = false }: ScanAssistantPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ScanAssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestedQuestions = getSuggestedQuestions(report);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    if (!open || isDemo) return;

    let cancelled = false;
    async function loadHistory() {
      setLoadingHistory(true);
      setError(null);

      try {
        const res = await fetch(`/api/scans/${report.id}/assistant`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(formatPlanError(data, res.status));
        setMessages(data.messages ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load conversation.");
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [isDemo, open, report.id]);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [messages, open, loading, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setError(null);
      setInput("");
      setLoading(true);

      const optimisticUser: ScanAssistantMessage = {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);

      try {
        if (isDemo) {
          const context = buildScanAssistantContext(report);
          const content = generateDeterministicAssistantResponse(report, context, trimmed);
          const assistant: ScanAssistantMessage = {
            id: `demo-assistant-${Date.now()}`,
            role: "assistant",
            content,
            source: "deterministic",
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistant]);
          return;
        }

        const res = await fetch(`/api/scans/${report.id}/assistant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(formatPlanError(data, res.status));
        }

        setMessages((prev) => {
          const withoutOptimistic = prev.filter((m) => m.id !== optimisticUser.id);
          return [
            ...withoutOptimistic,
            data.userMessage,
            data.message,
          ];
        });
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
        setError(err instanceof Error ? err.message : "Failed to send message.");
      } finally {
        setLoading(false);
      }
    },
    [isDemo, loading, report],
  );

  const regenerate = useCallback(async () => {
    if (loading || isDemo) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/scans/${report.id}/assistant/regenerate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatPlanError(data, res.status));

      setMessages((prev) => {
        const lastAssistantIndex = [...prev]
          .map((m, i) => ({ m, i }))
          .reverse()
          .find(({ m }) => m.role === "assistant")?.i;

        if (lastAssistantIndex === undefined) return prev;
        const next = [...prev];
        next[lastAssistantIndex] = data.message;
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate response.");
    } finally {
      setLoading(false);
    }
  }, [isDemo, loading, report.id]);

  async function copyMessage(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopyFeedback("Copied");
      window.setTimeout(() => setCopyFeedback(null), 1500);
    } catch {
      setCopyFeedback("Copy failed");
      window.setTimeout(() => setCopyFeedback(null), 1500);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="print:hidden fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-scanonix-orange px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-scanonix-orange/30 transition hover:brightness-110"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Security Copilot
      </button>

      {open ? (
        <div className="print:hidden fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close assistant"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0d1117]/95 shadow-2xl backdrop-blur-xl">
            <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-scanonix-orange">AI Security Copilot</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Ask about this scan</h2>
                <p className="mt-1 text-xs text-scanonix-muted">
                  Answers use structured scan results only — no invented findings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-scanonix-muted transition hover:bg-white/5 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {loadingHistory ? (
                <p className="text-sm text-scanonix-muted">Loading conversation…</p>
              ) : null}

              {messages.length === 0 && !loadingHistory ? (
                <div className="glass-card rounded-2xl p-4 text-sm text-scanonix-muted">
                  Ask about findings, prioritisation, risk score, remediation, or request an executive summary.
                  {isDemo ? (
                    <p className="mt-2 text-xs text-amber-300/90">
                      Demo mode — responses are generated locally and not saved.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    message.role === "user"
                      ? "ml-8 bg-scanonix-orange/15 text-white"
                      : "mr-4 glass-card text-neutral-100"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-scanonix-muted">
                      {message.role === "user" ? "You" : "Copilot"}
                    </span>
                    {message.role === "assistant" ? (
                      <div className="flex items-center gap-2">
                        {message.source ? (
                          <span className="text-[10px] uppercase text-scanonix-muted">{message.source}</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void copyMessage(message.content)}
                          className="text-xs text-scanonix-orange hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </div>
              ))}

              {loading ? (
                <div className="mr-4 glass-card rounded-2xl px-4 py-3 text-sm text-scanonix-muted">
                  Analysing scan results…
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-300">{error}</p> : null}
              {copyFeedback ? <p className="text-xs text-scanonix-muted">{copyFeedback}</p> : null}
            </div>

            <div className="border-t border-white/10 px-5 py-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    disabled={loading}
                    onClick={() => void sendMessage(question)}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs text-scanonix-muted transition hover:border-scanonix-orange/40 hover:text-white disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendMessage(input);
                }}
                className="flex gap-2"
              >
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about this scan…"
                  disabled={loading}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-scanonix-orange/50 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="rounded-xl bg-scanonix-orange px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Send
                </button>
              </form>

              {!isDemo && messages.some((m) => m.role === "assistant") ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void regenerate()}
                  className="mt-3 text-xs font-medium text-scanonix-muted hover:text-white disabled:opacity-50"
                >
                  Regenerate last response
                </button>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
