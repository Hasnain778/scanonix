"use client";

import { ActionButton } from "@/components/ui/ActionButton";
import type { SignatureAsset, SignatureSourceType } from "@/lib/tools/sign-pdf/types";

export interface SignatureAssetEntry {
  asset: SignatureAsset;
  previewUrl: string;
  aspectRatio: number;
}

interface SignatureAssetPaletteProps {
  assets: SignatureAssetEntry[];
  selectedAssetId: string | null;
  disabled?: boolean;
  onSelectAsset: (assetId: string) => void;
  onAddToPage: (assetId: string) => void;
  onCreateSignature: () => void;
}

function sourceLabel(sourceType: SignatureSourceType): string {
  switch (sourceType) {
    case "draw":
      return "Drawn";
    case "type":
      return "Typed";
    case "upload":
      return "Uploaded";
  }
}

export function SignatureAssetPalette({
  assets,
  selectedAssetId,
  disabled = false,
  onSelectAsset,
  onAddToPage,
  onCreateSignature,
}: SignatureAssetPaletteProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Signatures</h2>
          <p className="mt-1 text-sm text-scanonix-muted">
            Create a signature, select it, then add it to the current page.
          </p>
        </div>
        <ActionButton
          variant="outline"
          className="w-full sm:w-auto"
          disabled={disabled}
          onClick={onCreateSignature}
        >
          Create signature
        </ActionButton>
      </div>

      {assets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-scanonix-border px-4 py-6 text-center text-sm text-scanonix-muted">
          No signatures yet. Create one to begin placing it on the PDF.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {assets.map((entry) => {
            const isSelected = selectedAssetId === entry.asset.id;
            return (
              <li
                key={entry.asset.id}
                className={`rounded-xl border p-3 transition-colors ${
                  isSelected
                    ? "border-scanonix-orange bg-scanonix-orange/10 ring-2 ring-scanonix-orange/30"
                    : "border-scanonix-border bg-black/20"
                }`}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-left"
                  aria-pressed={isSelected}
                  disabled={disabled}
                  onClick={() => onSelectAsset(entry.asset.id)}
                >
                  <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-scanonix-border bg-[repeating-conic-gradient(#ffffff10_0%_25%,transparent_0%_50%)] bg-[length:12px_12px] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.previewUrl}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">
                      {sourceLabel(entry.asset.sourceType)} signature
                    </p>
                    <p className="text-xs text-scanonix-muted">
                      Reusable during this session
                    </p>
                  </div>
                </button>
                <ActionButton
                  size="sm"
                  className="mt-3 w-full"
                  disabled={disabled}
                  onClick={() => onAddToPage(entry.asset.id)}
                >
                  Add to page
                </ActionButton>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
