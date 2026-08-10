import type { PdfToWordProgressPhase } from "@/lib/tools/pdf-to-word/types";
import { getPdfToWordProgressMessage } from "@/lib/tools/pdf-to-word/types";
import type { ToolStatus } from "@/lib/tools/types";

interface PdfToWordProgressBannerProps {
  status: ToolStatus;
  phase?: PdfToWordProgressPhase;
  message?: string;
  progress?: { current: number; total: number };
}

export function PdfToWordProgressBanner({
  status,
  phase,
  message,
  progress,
}: PdfToWordProgressBannerProps) {
  if (status === "idle") {
    return null;
  }

  const styles = {
    loading: "border-scanonix-orange/40 bg-scanonix-orange/10 text-white",
    success: "border-green-500/40 bg-green-500/10 text-green-300",
    error: "border-red-500/40 bg-red-500/10 text-red-300",
  };

  const loadingMessage =
    message ??
    (phase
      ? getPdfToWordProgressMessage(phase, progress)
      : progress
        ? `Processing page ${progress.current} of ${progress.total}…`
        : "Processing…");

  const defaultMessages = {
    loading: loadingMessage,
    success: message ?? "Complete — Word document ready to download!",
    error: message ?? "Something went wrong. Please try again.",
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${styles[status]}`}
      role="status"
      aria-live="polite"
    >
      {status === "loading" && (
        <svg
          className="h-5 w-5 animate-spin text-scanonix-orange"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {status === "success" && (
        <svg
          className="h-5 w-5 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
      {status === "error" && (
        <svg
          className="h-5 w-5 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}
      <p className="text-sm font-medium">{defaultMessages[status]}</p>
    </div>
  );
}
