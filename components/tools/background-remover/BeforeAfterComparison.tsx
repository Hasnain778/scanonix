import { CheckerboardBackground } from "@/components/tools/background-remover/CheckerboardBackground";
import type { ReactNode } from "react";
import { resolveBackgroundColor } from "@/lib/tools/background-remover/composite-background";
import type { BackgroundPreviewMode } from "@/lib/tools/background-remover/types";

interface BeforeAfterComparisonProps {
  originalUrl: string;
  resultUrl: string;
  backgroundMode: BackgroundPreviewMode;
  customColor: string;
  originalLabel?: string;
  resultLabel?: string;
}

function PreviewFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <p className="text-sm font-medium text-scanonix-muted">{label}</p>
      <div className="overflow-hidden rounded-xl border border-scanonix-border">
        {children}
      </div>
    </div>
  );
}

export function BeforeAfterComparison({
  originalUrl,
  resultUrl,
  backgroundMode,
  customColor,
  originalLabel = "Original",
  resultLabel = "Background removed",
}: BeforeAfterComparisonProps) {
  const backgroundColor = resolveBackgroundColor(backgroundMode, customColor);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <PreviewFrame label={originalLabel}>
        <div className="flex aspect-[4/3] items-center justify-center bg-black/40 p-3 sm:p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={originalUrl}
            alt="Original uploaded image"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      </PreviewFrame>

      <PreviewFrame label={resultLabel}>
        <CheckerboardBackground className="flex aspect-[4/3] items-center justify-center p-3 sm:p-4">
          <div
            className="flex h-full w-full items-center justify-center"
            style={backgroundColor ? { backgroundColor } : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultUrl}
              alt="Image with background removed"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </CheckerboardBackground>
      </PreviewFrame>
    </div>
  );
}
