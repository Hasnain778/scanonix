"use client";

import type { CSSProperties } from "react";
import type { FieldOverlayStyle } from "@/lib/tools/fill-pdf/preview-geometry";

interface FormFieldOverlayProps {
  style: FieldOverlayStyle;
  selected?: boolean;
  fieldName: string;
  onSelect?: (fieldName: string) => void;
}

export function FormFieldOverlay({
  style,
  selected = false,
  fieldName,
  onSelect,
}: FormFieldOverlayProps) {
  const overlayStyle: CSSProperties = {
    left: style.left,
    top: style.top,
    width: style.width,
    height: style.height,
  };

  return (
    <button
      type="button"
      aria-label={`Select field ${fieldName}`}
      onClick={() => onSelect?.(fieldName)}
      className={`pointer-events-auto absolute touch-none border-2 transition ${
        selected
          ? "border-scanonix-orange bg-scanonix-orange/20 ring-2 ring-scanonix-orange/40"
          : "border-scanonix-orange/50 bg-scanonix-orange/10 hover:border-scanonix-orange hover:bg-scanonix-orange/15"
      }`}
      style={overlayStyle}
    />
  );
}
