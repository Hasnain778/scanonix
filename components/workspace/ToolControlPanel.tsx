import type { ReactNode } from "react";

interface ToolControlPanelProps {
  children: ReactNode;
  /** Optional pinned footer (e.g. primary Convert) — stays visible while body scrolls */
  footer?: ReactNode;
  className?: string;
  /** Accessible name for the complementary control region */
  "aria-label"?: string;
}

/**
 * Desktop sticky right control rail for tool workspaces.
 * Stacks normally below lg; sticky + internally scrollable from lg up.
 * Optional footer pins primary actions without nested sticky traps.
 */
export function ToolControlPanel({
  children,
  footer,
  className = "",
  "aria-label": ariaLabel = "Tool controls",
}: ToolControlPanelProps) {
  return (
    <aside
      aria-label={ariaLabel}
      className={`flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)] lg:sticky lg:top-24 lg:max-h-[calc(100vh-7.5rem)] lg:w-[320px] lg:shrink-0 ${className}`.trim()}
      data-tool-control-panel=""
    >
      <div
        className="min-h-0 flex-1 space-y-0 overflow-y-auto overscroll-contain p-4 sm:p-5 [scrollbar-color:color-mix(in_srgb,var(--scanonix-muted)_35%,transparent)_transparent] [scrollbar-width:thin]"
        data-tool-control-panel-body=""
      >
        {children}
      </div>
      {footer ? (
        <div
          className="shrink-0 border-t border-border bg-surface-raised/80 p-4 backdrop-blur-sm sm:px-5"
          data-tool-control-panel-footer=""
        >
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
