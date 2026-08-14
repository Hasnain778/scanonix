import dynamic from "next/dynamic";
import { LoadingState } from "@/components/common/LoadingState";

const toolLoading = () => (
  <LoadingState title="Loading tool…" description="Preparing the workspace." />
);

export const LazyMergePdfTool = dynamic(
  () =>
    import("@/components/tools/merge-pdf/MergePdfTool").then((m) => ({
      default: m.MergePdfTool,
    })),
  { loading: toolLoading },
);

export const LazySplitPdfTool = dynamic(
  () =>
    import("@/components/tools/split-pdf/SplitPdfTool").then((m) => ({
      default: m.SplitPdfTool,
    })),
  { loading: toolLoading },
);

export const LazyCompressPdfTool = dynamic(
  () =>
    import("@/components/tools/compress-pdf/CompressPdfTool").then((m) => ({
      default: m.CompressPdfTool,
    })),
  { loading: toolLoading },
);

export const LazyRotatePdfTool = dynamic(
  () =>
    import("@/components/tools/rotate-pdf/RotatePdfTool").then((m) => ({
      default: m.RotatePdfTool,
    })),
  { loading: toolLoading },
);

export const LazySignPdfTool = dynamic(
  () =>
    import("@/components/tools/sign-pdf/SignPdfTool").then((m) => ({
      default: m.SignPdfTool,
    })),
  { loading: toolLoading },
);

export const LazyImageToPdfTool = dynamic(
  () =>
    import("@/components/tools/image-to-pdf/ImageToPdfTool").then((m) => ({
      default: m.ImageToPdfTool,
    })),
  { loading: toolLoading },
);

export const LazyPdfToImageTool = dynamic(
  () =>
    import("@/components/tools/pdf-to-image/PdfToImageTool").then((m) => ({
      default: m.PdfToImageTool,
    })),
  { loading: toolLoading },
);

export const LazyPdfToWordTool = dynamic(
  () =>
    import("@/components/tools/pdf-to-word/PdfToWordTool").then((m) => ({
      default: m.PdfToWordTool,
    })),
  { loading: toolLoading },
);

export const LazyOcrTool = dynamic(
  () =>
    import("@/components/tools/ocr/OcrTool").then((m) => ({
      default: m.OcrTool,
    })),
  { loading: toolLoading },
);

export const LazyBackgroundRemoverTool = dynamic(
  () =>
    import("@/components/tools/background-remover/BackgroundRemoverTool").then(
      (m) => ({ default: m.BackgroundRemoverTool }),
    ),
  { loading: toolLoading },
);

export const LazyQrScannerTool = dynamic(
  () =>
    import("@/components/tools/qr-scanner/QrScannerTool").then((m) => ({
      default: m.QrScannerTool,
    })),
  { loading: toolLoading },
);

export const LazyAiSummaryTool = dynamic(
  () =>
    import("@/components/tools/ai-summary/AiSummaryTool").then((m) => ({
      default: m.AiSummaryTool,
    })),
  { loading: toolLoading },
);

export const LazyAiTranslateTool = dynamic(
  () =>
    import("@/components/tools/ai-translate/AiTranslateTool").then((m) => ({
      default: m.AiTranslateTool,
    })),
  { loading: toolLoading },
);

export const LazySecurityScanTool = dynamic(
  () =>
    import("@/components/tools/security-scan/SecurityScanTool").then((m) => ({
      default: m.SecurityScanTool,
    })),
  { loading: toolLoading },
);

export const LazyProtectPdfTool = dynamic(
  () =>
    import("@/components/tools/security/ProtectPdfTool").then((m) => ({
      default: m.ProtectPdfTool,
    })),
  { loading: toolLoading },
);

export const LazyUnlockPdfTool = dynamic(
  () =>
    import("@/components/tools/security/UnlockPdfTool").then((m) => ({
      default: m.UnlockPdfTool,
    })),
  { loading: toolLoading },
);

export const LazyWatermarkPdfTool = dynamic(
  () =>
    import("@/components/tools/security/WatermarkPdfTool").then((m) => ({
      default: m.WatermarkPdfTool,
    })),
  { loading: toolLoading },
);

export const LazyRedactPdfTool = dynamic(
  () =>
    import("@/components/tools/security/RedactPdfTool").then((m) => ({
      default: m.RedactPdfTool,
    })),
  { loading: toolLoading },
);

export const LazyMetadataCleanerTool = dynamic(
  () =>
    import("@/components/tools/security/MetadataCleanerTool").then((m) => ({
      default: m.MetadataCleanerTool,
    })),
  { loading: toolLoading },
);

export const LazyWordToPdfTool = dynamic(
  () =>
    import("@/components/tools/word-to-pdf/WordToPdfTool").then((m) => ({
      default: m.WordToPdfTool,
    })),
  { loading: toolLoading },
);

export const LazyImageCompressorTool = dynamic(
  () =>
    import("@/components/tools/image-compressor/ImageCompressorTool").then((m) => ({
      default: m.ImageCompressorTool,
    })),
  { loading: toolLoading },
);

export const LazyImageResizerTool = dynamic(
  () =>
    import("@/components/tools/image-resizer/ImageResizerTool").then((m) => ({
      default: m.ImageResizerTool,
    })),
  { loading: toolLoading },
);

export const LazyImageUpscalerTool = dynamic(
  () =>
    import("@/components/tools/image-upscaler/ImageUpscalerTool").then((m) => ({
      default: m.ImageUpscalerTool,
    })),
  { loading: toolLoading },
);

export const LazyAiRewriteTool = dynamic(
  () =>
    import("@/components/tools/ai-rewrite/AiRewriteTool").then((m) => ({
      default: m.AiRewriteTool,
    })),
  { loading: toolLoading },
);

export const LazyToolsDirectory = dynamic(
  () =>
    import("@/components/tools/directory/ToolsDirectory").then((m) => ({
      default: m.ToolsDirectory,
    })),
  { loading: toolLoading },
);
