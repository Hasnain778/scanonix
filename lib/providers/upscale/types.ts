export type UpscaleFactor = 2 | 4;

export interface UpscaleOptions {
  factor: UpscaleFactor;
  /** Tile size for large images (0 = auto/no tiling). */
  tileSize?: number;
  /** Preserve PNG transparency when input has alpha. */
  preserveAlpha?: boolean;
}

export interface UpscaleResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: "png" | "jpeg";
}

export interface UpscaleProvider {
  upscale(input: Buffer, options: UpscaleOptions): Promise<UpscaleResult>;
}
