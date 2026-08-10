export type PageSize = "a4" | "letter" | "fit";
export type PageOrientation = "portrait" | "landscape";
export type Rotation = 0 | 90 | 180 | 270;
export type ToolStatus = "idle" | "loading" | "success" | "error";

export interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  rotation: Rotation;
}

export interface PdfGenerationOptions {
  pageSize: PageSize;
  orientation: PageOrientation;
}

export interface ProcessedImage {
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  format: "JPEG" | "PNG";
}

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
] as const;

export const ACCEPTED_IMAGE_EXTENSIONS = ".jpg,.jpeg,.png";
export const ACCEPTED_JPEG_EXTENSIONS = ".jpg,.jpeg";
export const ACCEPTED_PDF_EXTENSIONS = ".pdf";

export interface JpgImageItem {
  id: string;
  file: File;
  previewUrl: string;
  width: number | null;
  height: number | null;
}

export type JpgToPngResizeMode = "original" | "custom";

export interface JpgToPngOptions {
  resizeMode: JpgToPngResizeMode;
  width: number;
  height: number;
  transparentBackground: boolean;
}

export interface PdfFileItem {
  id: string;
  file: File;
  pageCount: number | null;
  pageCountError?: string;
}

export type SplitMode =
  | "individual"
  | "ranges"
  | "every-page"
  | "fixed-interval";

export interface SplitOutput {
  filename: string;
  blob: Blob;
}

export type PdfToImageMode = "all" | "individual" | "ranges";
export type ImageExportFormat = "jpg" | "png" | "webp";
export type ImageExportQuality = "standard" | "high" | "maximum";
export type ImageExportScale = 1 | 2 | 3;

export interface ImageOutput {
  filename: string;
  blob: Blob;
}

export interface PdfToImageOptions {
  format: ImageExportFormat;
  quality: ImageExportQuality;
  scale: ImageExportScale;
}

export interface NamedBlobOutput {
  filename: string;
  blob: Blob;
}
