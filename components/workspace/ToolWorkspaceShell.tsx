import type { ReactNode } from "react";

interface ToolWorkspaceShellProps {
  /** Pre-upload / empty interactive content (no right rail). */
  empty?: ReactNode;
  /** Dominant left work surface (preview, editor, canvas). */
  workArea?: ReactNode;
  /** Sticky right control rail content (wrapped by ToolControlPanel by caller or here). */
  controlPanel?: ReactNode;
  /** When true, renders empty slot only. When false/undefined with workArea, renders workspace. */
  isEmpty?: boolean;
  className?: string;
}

/**
 * Composition shell for Scanonix tool workspaces.
 * Empty: simple stacked content. Workspace: left work + right controls at lg+.
 */
export function ToolWorkspaceShell({
  empty,
  workArea,
  controlPanel,
  isEmpty = false,
  className = "",
}: ToolWorkspaceShellProps) {
  if (isEmpty) {
    return (
      <div className={`space-y-5 ${className}`.trim()} data-tool-workspace="empty">
        {empty}
      </div>
    );
  }

  return (
    <div
      className={`grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start ${className}`.trim()}
      data-tool-workspace="active"
    >
      <div className="min-w-0 space-y-4" data-tool-work-area="">
        {workArea}
      </div>
      {controlPanel}
    </div>
  );
}
