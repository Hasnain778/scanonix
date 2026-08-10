export interface BackgroundRemovalOptions {
  /** Max longest edge for server-side preprocessing (never upscale). */
  processingMaxLongEdge: number;
}

export interface BackgroundRemovalResult {
  buffer: Buffer;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  wasOptimized: boolean;
  likelyNoSubject: boolean;
  provider?: string;
  model?: string;
}

export interface BackgroundRemovalProvider {
  removeBackground(
    input: Buffer,
    mimeType: string,
    options: BackgroundRemovalOptions,
  ): Promise<BackgroundRemovalResult>;
}
