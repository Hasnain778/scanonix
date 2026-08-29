"use client";

import { type ReactNode } from "react";
import { ActionButton } from "@/components/ui/ActionButton";

interface ToolResultsPanelProps {
  title?: string;
  children?: ReactNode;
  primaryLabel: string;
  onPrimaryClick: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
  secondaryDisabled?: boolean;
  onStartOver?: () => void;
  startOverLabel?: string;
  startOverDisabled?: boolean;
}

export function ToolResultsPanel({
  title = "Results",
  children,
  primaryLabel,
  onPrimaryClick,
  primaryLoading = false,
  primaryDisabled = false,
  secondaryLabel,
  onSecondaryClick,
  secondaryDisabled = false,
  onStartOver,
  startOverLabel = "Start over",
  startOverDisabled = false,
}: ToolResultsPanelProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="mb-2 text-lg font-semibold text-foreground">{title}</h2>
      {children}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <ActionButton
          size="lg"
          className="w-full sm:w-auto"
          loading={primaryLoading}
          disabled={primaryDisabled || primaryLoading}
          onClick={onPrimaryClick}
        >
          {primaryLabel}
        </ActionButton>
        {secondaryLabel && onSecondaryClick ? (
          <ActionButton
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            disabled={secondaryDisabled || primaryLoading}
            onClick={onSecondaryClick}
          >
            {secondaryLabel}
          </ActionButton>
        ) : null}
        {onStartOver && (
          <ActionButton
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            disabled={startOverDisabled || primaryLoading}
            onClick={onStartOver}
          >
            {startOverLabel}
          </ActionButton>
        )}
      </div>
    </div>
  );
}
