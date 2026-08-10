import type { Config } from "@imgly/background-removal";
import { normalizeFileToPngBlob } from "@/lib/image/normalize";
import {
  analyzeTransparentBlob,
  blobToPreviewUrl,
} from "@/lib/tools/background-remover/analyze-result";
import { validateBackgroundRemoverFile } from "@/lib/tools/background-remover/file-validation";
import {
  BackgroundRemoverError,
  type BackgroundRemoverProgressCallback,
  type BackgroundRemoverProgressPhase,
} from "@/lib/tools/background-remover/types";
import type {
  BackgroundRemovalOptions,
  BackgroundRemovalProvider,
  BackgroundRemovalResult,
} from "./types";

export interface BrowserBackgroundRemovalResult extends BackgroundRemovalResult {
  transparentBlob: Blob;
  previewUrl: string;
}

let removeBackgroundFn:
  | typeof import("@imgly/background-removal").removeBackground
  | null = null;

async function loadRemoveBackground() {
  if (!removeBackgroundFn) {
    const bgRemovalModule = await import("@imgly/background-removal");
    removeBackgroundFn = bgRemovalModule.removeBackground;
  }

  return removeBackgroundFn;
}

function mapProgressKeyToPhase(key: string): BackgroundRemoverProgressPhase {
  if (key.startsWith("fetch:")) {
    return "loading-model";
  }

  if (key.startsWith("compute:")) {
    return "removing-background";
  }

  return "removing-background";
}

/** Legacy browser-side provider — not used in production API routes. */
export const imglyBrowserProvider: BackgroundRemovalProvider = {
  async removeBackground(input, mimeType, options) {
    void options;
    const blob = new Blob([new Uint8Array(input)], { type: mimeType });
    const file = new File([blob], "input.png", { type: mimeType });
    const result = await removeImageBackgroundInBrowser(file);
    return {
      buffer: Buffer.from(await result.transparentBlob.arrayBuffer()),
      width: result.width,
      height: result.height,
      originalWidth: result.originalWidth,
      originalHeight: result.originalHeight,
      wasOptimized: result.wasOptimized,
      likelyNoSubject: result.likelyNoSubject,
    };
  },
};

export async function removeImageBackgroundInBrowser(
  file: File,
  onProgress?: BackgroundRemoverProgressCallback,
): Promise<BrowserBackgroundRemovalResult> {
  onProgress?.("preparing");

  const { width, height } = await validateBackgroundRemoverFile(file);

  let preparedInput: Blob;

  try {
    preparedInput = await normalizeFileToPngBlob(file);
  } catch {
    throw new BackgroundRemoverError(
      "FAILURE",
      "Could not prepare this image for background removal.",
    );
  }

  let currentPhase: BackgroundRemoverProgressPhase = "loading-model";

  const config: Config = {
    model: "isnet",
    output: {
      format: "image/png",
      quality: 1,
    },
    progress: (key, current, total) => {
      currentPhase = mapProgressKeyToPhase(key);
      onProgress?.(currentPhase, { current, total });
    },
  };

  try {
    const removeBackground = await loadRemoveBackground();

    if (currentPhase === "loading-model") {
      onProgress?.("loading-model");
    }

    onProgress?.("removing-background");

    const transparentBlob = await removeBackground(preparedInput, config);

    onProgress?.("finalising");

    const analysis = await analyzeTransparentBlob(transparentBlob);

    if (analysis.likelyNoSubject) {
      throw new BackgroundRemoverError(
        "NO_SUBJECT",
        "Could not detect a clear subject in this image. Try a photo with a distinct foreground object or person.",
      );
    }

    const previewUrl = await blobToPreviewUrl(transparentBlob);

    onProgress?.("complete");

    return {
      transparentBlob,
      previewUrl,
      width,
      height,
      originalWidth: width,
      originalHeight: height,
      wasOptimized: false,
      likelyNoSubject: analysis.likelyNoSubject,
      buffer: Buffer.from(await transparentBlob.arrayBuffer()),
    };
  } catch (error) {
    if (error instanceof BackgroundRemoverError) {
      throw error;
    }

    throw new BackgroundRemoverError(
      "FAILURE",
      "Background removal failed. Try a smaller image or a photo with a clearer subject.",
    );
  }
}

/** @deprecated Use server API via lib/tools/background-remover/client.ts */
export async function removeImageBackground(
  file: File,
  onProgress?: BackgroundRemoverProgressCallback,
): Promise<Omit<BrowserBackgroundRemovalResult, "buffer">> {
  const result = await removeImageBackgroundInBrowser(file, onProgress);
  return {
    transparentBlob: result.transparentBlob,
    previewUrl: result.previewUrl,
    width: result.width,
    height: result.height,
    originalWidth: result.originalWidth,
    originalHeight: result.originalHeight,
    wasOptimized: result.wasOptimized,
    likelyNoSubject: result.likelyNoSubject,
  };
}

export type { BackgroundRemovalOptions, BackgroundRemovalResult };
