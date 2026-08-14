import { loadImageElement } from "../image-utils";
import type {
  BackgroundPreviewMode,
  ExportFormat,
  ResolutionPresetId,
} from "./studio-types";
import { calculateOutputDimensions } from "./studio-types";

export interface StudioBackgroundOptions {
  mode: BackgroundPreviewMode;
  customColor: string;
  gradientStart: string;
  gradientEnd: string;
  backgroundImageUrl: string | null;
}

export interface StudioExportOptions {
  transparentBlob: Blob;
  sourceWidth: number;
  sourceHeight: number;
  resolutionPreset: ResolutionPresetId;
  background: StudioBackgroundOptions;
  format: ExportFormat;
  quality: number;
}

function paintBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: StudioBackgroundOptions,
  backgroundImage?: HTMLImageElement | null,
): void {
  switch (background.mode) {
    case "transparent":
      return;
    case "white":
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      return;
    case "black":
      context.fillStyle = "#000000";
      context.fillRect(0, 0, width, height);
      return;
    case "custom":
      context.fillStyle = background.customColor;
      context.fillRect(0, 0, width, height);
      return;
    case "gradient": {
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, background.gradientStart);
      gradient.addColorStop(1, background.gradientEnd);
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      return;
    }
    case "upload":
      if (backgroundImage) {
        const scale = Math.max(
          width / backgroundImage.naturalWidth,
          height / backgroundImage.naturalHeight,
        );
        const drawWidth = backgroundImage.naturalWidth * scale;
        const drawHeight = backgroundImage.naturalHeight * scale;
        const offsetX = (width - drawWidth) / 2;
        const offsetY = (height - drawHeight) / 2;
        context.drawImage(
          backgroundImage,
          offsetX,
          offsetY,
          drawWidth,
          drawHeight,
        );
      } else {
        context.fillStyle = "#1b1b1b";
        context.fillRect(0, 0, width, height);
      }
      return;
  }
}

export async function renderStudioImage(
  options: StudioExportOptions,
): Promise<Blob> {
  let background = options.background;

  if (background.mode === "transparent" && options.format !== "png") {
    background = { ...background, mode: "white" };
  }

  const { width, height } = calculateOutputDimensions(
    options.sourceWidth,
    options.sourceHeight,
    options.resolutionPreset,
  );

  const subjectUrl = URL.createObjectURL(options.transparentBlob);

  try {
    const subject = await loadImageElement(subjectUrl);
    let backgroundImage: HTMLImageElement | null = null;

    if (
      options.background.mode === "upload" &&
      options.background.backgroundImageUrl
    ) {
      backgroundImage = await loadImageElement(
        options.background.backgroundImageUrl,
      );
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is not supported in this browser");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    paintBackground(context, width, height, background, backgroundImage);
    context.drawImage(subject, 0, 0, width, height);

    const mimeType =
      options.format === "png"
        ? "image/png"
        : options.format === "jpg"
          ? "image/jpeg"
          : "image/webp";

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error(`Failed to create ${options.format.toUpperCase()} image`));
          }
        },
        mimeType,
        options.format === "png" ? undefined : options.quality,
      );
    });
  } finally {
    URL.revokeObjectURL(subjectUrl);
  }
}

export function resolvePreviewBackgroundStyle(
  background: StudioBackgroundOptions,
): Record<string, string> | undefined {
  switch (background.mode) {
    case "transparent":
      return undefined;
    case "white":
      return { backgroundColor: "#ffffff" };
    case "black":
      return { backgroundColor: "#000000" };
    case "custom":
      return { backgroundColor: background.customColor };
    case "gradient":
      return {
        background: `linear-gradient(135deg, ${background.gradientStart}, ${background.gradientEnd})`,
      };
    case "upload":
      if (background.backgroundImageUrl) {
        return {
          backgroundImage: `url(${background.backgroundImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        };
      }
      return { backgroundColor: "#1b1b1b" };
  }
}
