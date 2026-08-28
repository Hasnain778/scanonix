"use client";

import { useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import {
  MobileStickyActionSurfaceContext,
} from "@/components/tools/MobileStickyActionSurfaceContext";
import type { ResultActionPhase } from "@/components/tools/result-action-types";

/**
 * Legacy sticky props remain the default contract. Existing callers that omit
 * `phase` keep pre-130J-4 rendering (primary + optional secondary only).
 *
 * Opt-in result mode: pass `phase`. Then Start Over can render as a dedicated
 * action and phase gates which actions appear. Callers still control `visible`.
 */
export interface ToolStickyMobileActionBarProps {
  visible: boolean;
  primaryLabel: string;
  onPrimaryClick: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
  secondaryDisabled?: boolean;
  /** Opt-in result-action semantics. Omit for legacy behavior. */
  phase?: ResultActionPhase;
  startOverLabel?: string;
  onStartOver?: () => void;
  startOverDisabled?: boolean;
  /**
   * When phase is "error", show primary if true. Default false.
   * Only applies in result mode (`phase` set).
   */
  showPrimaryOnError?: boolean;
}

const LEGACY_SPACER_FALLBACK_PX = 96; // h-24

export function ToolStickyMobileActionBar({
  visible,
  primaryLabel,
  onPrimaryClick,
  primaryLoading = false,
  primaryDisabled = false,
  secondaryLabel,
  onSecondaryClick,
  secondaryDisabled = false,
  phase,
  startOverLabel = "Start over",
  onStartOver,
  startOverDisabled = false,
  showPrimaryOnError = false,
}: ToolStickyMobileActionBarProps) {
  const resultMode = phase !== undefined;
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeightPx, setBarHeightPx] = useState(LEGACY_SPACER_FALLBACK_PX);
  const surface = useContext(MobileStickyActionSurfaceContext);

  const actions = useMemo(
    () =>
      resolveStickyActions({
        resultMode,
        phase,
        primaryLabel,
        onPrimaryClick,
        primaryLoading,
        primaryDisabled,
        secondaryLabel,
        onSecondaryClick,
        secondaryDisabled,
        startOverLabel,
        onStartOver,
        startOverDisabled,
        showPrimaryOnError,
      }),
    [
      resultMode,
      phase,
      primaryLabel,
      onPrimaryClick,
      primaryLoading,
      primaryDisabled,
      secondaryLabel,
      onSecondaryClick,
      secondaryDisabled,
      startOverLabel,
      onStartOver,
      startOverDisabled,
      showPrimaryOnError,
    ],
  );

  const mounted =
    visible &&
    actions.length > 0 &&
    (!resultMode || phase !== "idle");

  useLayoutEffect(() => {
    if (!mounted) {
      surface?.setInsetBottomPx(0);
      return;
    }

    const node = barRef.current;
    if (!node) return;

    const publish = () => {
      const next = Math.ceil(node.getBoundingClientRect().height);
      if (next <= 0) return;
      setBarHeightPx(next);
      surface?.setInsetBottomPx(next);
    };

    publish();

    if (typeof ResizeObserver === "undefined") {
      return () => {
        surface?.setInsetBottomPx(0);
      };
    }

    const observer = new ResizeObserver(publish);
    observer.observe(node);
    return () => {
      observer.disconnect();
      surface?.setInsetBottomPx(0);
    };
  }, [
    mounted,
    actions.length,
    primaryLabel,
    secondaryLabel,
    startOverLabel,
    phase,
    resultMode,
    surface,
  ]);

  if (!mounted) {
    return null;
  }

  return (
    <>
      <div
        className="md:hidden"
        style={{ height: barHeightPx }}
        aria-hidden="true"
        data-sticky-action-spacer=""
      />
      <div
        ref={barRef}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#121212]/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden"
        data-sticky-action-bar=""
        data-sticky-action-mode={resultMode ? "result" : "legacy"}
        data-result-action-phase={phase ?? "legacy"}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-2">
          {actions.map((action) => (
            <ActionButton
              key={action.key}
              type="button"
              size="lg"
              className="w-full min-w-0"
              variant={action.variant}
              loading={action.loading}
              disabled={action.disabled}
              onClick={action.onClick}
              aria-label={action.ariaLabel}
            >
              {action.label}
            </ActionButton>
          ))}
        </div>
      </div>
    </>
  );
}

type StickyActionRow = {
  key: string;
  label: string;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  variant: "primary" | "outline";
  ariaLabel?: string;
};

function resolveStickyActions(input: {
  resultMode: boolean;
  phase?: ResultActionPhase;
  primaryLabel: string;
  onPrimaryClick: () => void;
  primaryLoading: boolean;
  primaryDisabled: boolean;
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
  secondaryDisabled: boolean;
  startOverLabel: string;
  onStartOver?: () => void;
  startOverDisabled: boolean;
  showPrimaryOnError: boolean;
}): StickyActionRow[] {
  const {
    resultMode,
    phase,
    primaryLabel,
    onPrimaryClick,
    primaryLoading,
    primaryDisabled,
    secondaryLabel,
    onSecondaryClick,
    secondaryDisabled,
    startOverLabel,
    onStartOver,
    startOverDisabled,
    showPrimaryOnError,
  } = input;

  // --- Legacy path: identical semantics to pre-130J-4 ---
  if (!resultMode) {
    const rows: StickyActionRow[] = [
      {
        key: "primary",
        label: primaryLabel,
        onClick: onPrimaryClick,
        loading: primaryLoading,
        disabled: primaryDisabled || primaryLoading,
        variant: "primary",
      },
    ];
    if (secondaryLabel && onSecondaryClick) {
      rows.push({
        key: "secondary",
        label: secondaryLabel,
        onClick: onSecondaryClick,
        loading: false,
        disabled: secondaryDisabled || primaryLoading,
        variant: "outline",
      });
    }
    return rows;
  }

  // --- Opt-in result mode ---
  const rows: StickyActionRow[] = [];
  const processing = phase === "processing";
  const allowPrimary =
    phase === "ready" ||
    phase === "processing" ||
    phase === "success" ||
    (phase === "error" && showPrimaryOnError);

  if (allowPrimary) {
    rows.push({
      key: "primary",
      label: primaryLabel,
      onClick: onPrimaryClick,
      loading: primaryLoading || processing,
      disabled: primaryDisabled || primaryLoading || processing,
      variant: "primary",
    });
  }

  if (
    (phase === "ready" || phase === "success") &&
    secondaryLabel &&
    onSecondaryClick
  ) {
    rows.push({
      key: "secondary",
      label: secondaryLabel,
      onClick: onSecondaryClick,
      loading: false,
      disabled: secondaryDisabled || primaryLoading || processing,
      variant: "outline",
    });
  }

  if (
    onStartOver &&
    (phase === "ready" ||
      phase === "success" ||
      phase === "error" ||
      phase === "processing")
  ) {
    rows.push({
      key: "start-over",
      label: startOverLabel,
      onClick: onStartOver,
      loading: false,
      disabled: startOverDisabled || primaryLoading || processing,
      variant: "outline",
      ariaLabel: startOverLabel,
    });
  }

  return rows;
}
