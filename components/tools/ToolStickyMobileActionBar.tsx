"use client";

import { ActionButton } from "@/components/ui/ActionButton";

interface ToolStickyMobileActionBarProps {
  visible: boolean;
  primaryLabel: string;
  onPrimaryClick: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
  secondaryDisabled?: boolean;
}

export function ToolStickyMobileActionBar({
  visible,
  primaryLabel,
  onPrimaryClick,
  primaryLoading = false,
  primaryDisabled = false,
  secondaryLabel,
  onSecondaryClick,
  secondaryDisabled = false,
}: ToolStickyMobileActionBarProps) {
  if (!visible) return null;

  return (
    <>
      <div className="h-24 md:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#121212]/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-2">
          <ActionButton
            size="lg"
            className="w-full"
            loading={primaryLoading}
            disabled={primaryDisabled || primaryLoading}
            onClick={onPrimaryClick}
          >
            {primaryLabel}
          </ActionButton>
          {secondaryLabel && onSecondaryClick && (
            <ActionButton
              variant="outline"
              size="lg"
              className="w-full"
              disabled={secondaryDisabled || primaryLoading}
              onClick={onSecondaryClick}
            >
              {secondaryLabel}
            </ActionButton>
          )}
        </div>
      </div>
    </>
  );
}
