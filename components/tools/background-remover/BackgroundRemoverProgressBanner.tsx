import type { ToolStatus } from "@/lib/tools/types";

interface BackgroundRemoverProgressBannerProps {
  status: ToolStatus;
  message?: string;
}

export function BackgroundRemoverProgressBanner({
  status,
  message,
}: BackgroundRemoverProgressBannerProps) {
  if (status === "idle" || status === "loading") {
    return null;
  }

  const styles = {
    loading: "border-scanonix-orange/40 bg-scanonix-orange/10 text-foreground",
    success: "border-green-600/35 bg-green-500/10 text-green-700",
    error: "border-red-500/40 bg-red-500/10 text-red-300",
  };

  const defaultMessages = {
    success: message ?? "Complete — background removed successfully!",
    error: message ?? "Something went wrong. Please try again.",
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${styles[status]}`}
      role="status"
      aria-live="polite"
    >
      {status === "success" && (
        <svg
          className="h-5 w-5 text-green-600"
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
