"use client";

import { ActionButton } from "@/components/ui/ActionButton";
import type {
  ResultAction,
  ResultActionPhase,
} from "@/components/tools/result-action-types";

export type { ResultAction, ResultActionPhase };

export interface ResultActionBarProps {
  phase: ResultActionPhase;
  primary?: ResultAction;
  secondary?: ResultAction;
  startOver?: ResultAction;
  /**
   * When true and phase is "error", render primary if supplied and not hidden.
   * Default false — prevents stale Download on failure.
   */
  showPrimaryOnError?: boolean;
  className?: string;
}

function isActionVisible(action: ResultAction | undefined): action is ResultAction {
  return Boolean(action && !action.hidden);
}

/**
 * Inline (non-fixed) result action chrome. Callback-only — no download, quota,
 * analytics, or processing ownership.
 */
export function ResultActionBar({
  phase,
  primary,
  secondary,
  startOver,
  showPrimaryOnError = false,
  className = "",
}: ResultActionBarProps) {
  if (phase === "idle") {
    return null;
  }

  const isProcessing = phase === "processing";
  const allowPrimary =
    phase === "ready" ||
    isProcessing ||
    phase === "success" ||
    (phase === "error" && showPrimaryOnError);

  const showPrimary = allowPrimary && isActionVisible(primary);
  const showSecondary =
    (phase === "ready" || phase === "success") && isActionVisible(secondary);
  const showStartOver =
    (phase === "ready" ||
      phase === "success" ||
      phase === "error" ||
      isProcessing) &&
    isActionVisible(startOver);

  if (!showPrimary && !showSecondary && !showStartOver) {
    return null;
  }

  const primaryBusy = Boolean(primary?.loading) || isProcessing;
  const primaryDisabled = Boolean(primary?.disabled) || primaryBusy;
  const secondaryDisabled =
    Boolean(secondary?.disabled) || primaryBusy;
  const startOverDisabled = Boolean(startOver?.disabled) || primaryBusy;

  return (
    <div
      className={`flex w-full max-w-full flex-col gap-3 sm:flex-row sm:flex-wrap ${className}`.trim()}
      data-result-action-phase={phase}
      data-result-action-bar=""
    >
      {showPrimary ? (
        <ActionButton
          type="button"
          size="lg"
          className="w-full min-w-0 sm:w-auto"
          loading={Boolean(primary.loading) || isProcessing}
          disabled={primaryDisabled}
          onClick={primary.onClick}
          aria-label={primary.ariaLabel}
        >
          {primary.label}
        </ActionButton>
      ) : null}

      {showSecondary ? (
        <ActionButton
          type="button"
          variant="outline"
          size="lg"
          className="w-full min-w-0 sm:w-auto"
          loading={Boolean(secondary.loading)}
          disabled={secondaryDisabled || Boolean(secondary.loading)}
          onClick={secondary.onClick}
          aria-label={secondary.ariaLabel}
        >
          {secondary.label}
        </ActionButton>
      ) : null}

      {showStartOver ? (
        <ActionButton
          type="button"
          variant="outline"
          size="lg"
          className="w-full min-w-0 sm:w-auto"
          loading={Boolean(startOver.loading)}
          disabled={startOverDisabled || Boolean(startOver.loading)}
          onClick={startOver.onClick}
          aria-label={startOver.ariaLabel ?? startOver.label}
        >
          {startOver.label}
        </ActionButton>
      ) : null}
    </div>
  );
}
