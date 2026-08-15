/** Preview overlay adapter for Fill PDF Forms workspace (Phase 123C). */

import type { NormalizedCropRect } from "../crop-pdf/types";
import type { FormFieldDescriptor, FormFieldKind, FormWidgetDescriptor } from "./types";

export interface FieldOverlayStyle {
  left: string;
  top: string;
  width: string;
  height: string;
}

/**
 * Map a 123B normalized widget rectangle to CSS overlay percentages
 * for the PDF.js preview container. Uses precomputed normalizedRect —
 * no duplicate rotation math.
 */
export function normalizedRectToOverlayStyle(
  rect: NormalizedCropRect,
): FieldOverlayStyle {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  };
}

export interface OverlayPixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function parsePercent(value: string): number {
  return Number.parseFloat(value) / 100;
}

/** Map percentage overlay CSS to pixel coordinates within a preview container. */
export function overlayStyleToPixelRect(
  style: FieldOverlayStyle,
  containerWidth: number,
  containerHeight: number,
): OverlayPixelRect {
  return {
    left: parsePercent(style.left) * containerWidth,
    top: parsePercent(style.top) * containerHeight,
    width: parsePercent(style.width) * containerWidth,
    height: parsePercent(style.height) * containerHeight,
  };
}

/**
 * Overlay rects scale proportionally when the preview container is zoomed.
 * Percentage-based CSS positions remain stable; this helper validates alignment math.
 */
export function overlayStyleToPixelRectWithZoom(
  style: FieldOverlayStyle,
  baseWidth: number,
  baseHeight: number,
  zoomFactor: number,
): OverlayPixelRect {
  const zoomedWidth = baseWidth * zoomFactor;
  const zoomedHeight = baseHeight * zoomFactor;
  return overlayStyleToPixelRect(style, zoomedWidth, zoomedHeight);
}

export function getWidgetsForPage(
  widgets: FormWidgetDescriptor[],
  pageIndex: number,
): FormWidgetDescriptor[] {
  return widgets.filter((widget) => widget.pageIndex === pageIndex);
}

export function getFieldPrimaryPageIndex(
  descriptor: FormFieldDescriptor,
): number {
  if (descriptor.widgets.length === 0) {
    return 0;
  }

  return Math.min(...descriptor.widgets.map((widget) => widget.pageIndex));
}

export interface PageFieldOverlayEntry {
  fieldName: string;
  widgetIndex: number;
  kind: FormFieldKind;
  style: FieldOverlayStyle;
  normalizedRect: NormalizedCropRect;
  widgetExportValue?: string;
  widgetOptionValue?: string;
  widgetDisplayLabel?: string;
  readOnly: boolean;
  required: boolean;
}

export function buildPageFieldOverlays(
  descriptors: FormFieldDescriptor[],
  pageIndex: number,
): PageFieldOverlayEntry[] {
  const overlays: PageFieldOverlayEntry[] = [];

  for (const descriptor of descriptors) {
    descriptor.widgets.forEach((widget) => {
      if (widget.pageIndex !== pageIndex) {
        return;
      }

      overlays.push(buildOverlayEntry(descriptor, widget));
    });
  }

  return overlays.sort((left, right) => {
    if (left.normalizedRect.y !== right.normalizedRect.y) {
      return left.normalizedRect.y - right.normalizedRect.y;
    }
    return left.normalizedRect.x - right.normalizedRect.x;
  });
}

function buildOverlayEntry(
  descriptor: FormFieldDescriptor,
  widget: FormWidgetDescriptor,
): PageFieldOverlayEntry {
  return {
    fieldName: descriptor.name,
    widgetIndex: widget.widgetIndex,
    kind: descriptor.kind,
    style: normalizedRectToOverlayStyle(widget.normalizedRect),
    normalizedRect: widget.normalizedRect,
    widgetExportValue: widget.widgetExportValue,
    widgetOptionValue: widget.widgetOptionValue,
    widgetDisplayLabel: widget.widgetDisplayLabel,
    readOnly: descriptor.readOnly,
    required: descriptor.required,
  };
}
