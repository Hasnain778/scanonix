import { getPlanLimits } from "@/lib/plan/config";

export type ToolProcessing = "client" | "server";

export interface ToolAccessConfig {
  requiresAuth: boolean;
  requiresPro: boolean;
  requiresPremiumAi?: boolean;
  processing: ToolProcessing;
  route: string;
}

const FREE_CLIENT: Omit<ToolAccessConfig, "route"> = {
  requiresAuth: false,
  requiresPro: false,
  processing: "client",
};

const FREE_SERVER: Omit<ToolAccessConfig, "route"> = {
  requiresAuth: false,
  requiresPro: false,
  processing: "server",
};

const PRO_SECURITY: Omit<ToolAccessConfig, "route" | "processing"> = {
  requiresAuth: true,
  requiresPro: true,
};

const PREMIUM_AI: Omit<ToolAccessConfig, "route" | "processing"> = {
  requiresAuth: true,
  requiresPro: true,
  requiresPremiumAi: true,
};

export const TOOL_ACCESS: Record<string, ToolAccessConfig> = {
  "compress-pdf": { ...FREE_SERVER, route: "compress-pdf" },
  "merge-pdf": { ...FREE_CLIENT, route: "merge-pdf" },
  "split-pdf": { ...FREE_CLIENT, route: "split-pdf" },
  "rotate-pdf": { ...FREE_CLIENT, route: "rotate-pdf" },
  "organize-pdf": { ...FREE_CLIENT, route: "organize-pdf" },
  "crop-pdf": { ...FREE_CLIENT, route: "crop-pdf" },
  "add-page-numbers": { ...FREE_CLIENT, route: "add-page-numbers" },
  "fill-pdf": { ...FREE_CLIENT, route: "fill-pdf" },
  "sign-pdf": { ...FREE_CLIENT, route: "sign-pdf" },
  "pdf-to-word": {
    ...PRO_SECURITY,
    processing: "server",
    route: "pdf-to-word",
  },
  "pdf-to-image": { ...FREE_CLIENT, route: "pdf-to-image" },
  "image-to-pdf": { ...FREE_CLIENT, route: "image-to-pdf" },
  "word-to-pdf": { ...FREE_SERVER, route: "word-to-pdf" },
  ocr: { ...FREE_CLIENT, route: "ocr" },
  "qr-scanner": { ...FREE_CLIENT, route: "qr-scanner" },
  "background-remover": { ...FREE_SERVER, route: "background-remover" },
  "image-compressor": { ...FREE_SERVER, route: "image-compressor" },
  "image-resizer": { ...FREE_SERVER, route: "image-resizer" },
  "jpg-to-png": { ...FREE_CLIENT, route: "jpg-to-png" },
  "png-to-jpg": { ...FREE_CLIENT, route: "png-to-jpg" },
  "jpg-to-webp": { ...FREE_CLIENT, route: "jpg-to-webp" },
  "png-to-webp": { ...FREE_CLIENT, route: "png-to-webp" },
  "webp-to-jpg": { ...FREE_CLIENT, route: "webp-to-jpg" },
  "webp-to-png": { ...FREE_CLIENT, route: "webp-to-png" },
  "heic-to-jpg": { ...FREE_CLIENT, route: "heic-to-jpg" },
  "heic-to-png": { ...FREE_CLIENT, route: "heic-to-png" },
  "image-upscaler": {
    ...PREMIUM_AI,
    processing: "server",
    route: "image-upscaler",
  },
  "ai-rewrite": {
    ...PREMIUM_AI,
    processing: "server",
    route: "ai-rewrite",
  },
  "ai-translate": {
    ...PREMIUM_AI,
    processing: "server",
    route: "ai-translate",
  },
  "ai-summary": {
    ...PREMIUM_AI,
    processing: "server",
    route: "ai-summary",
  },
  "protect-pdf": {
    ...PRO_SECURITY,
    processing: "server",
    route: "protect-pdf",
  },
  "unlock-pdf": {
    ...PRO_SECURITY,
    processing: "server",
    route: "unlock-pdf",
  },
  "watermark-pdf": { ...FREE_CLIENT, route: "watermark-pdf" },
  "redact-pdf": {
    ...PRO_SECURITY,
    processing: "client",
    route: "redact-pdf",
  },
  "metadata-cleaner": {
    ...PRO_SECURITY,
    processing: "server",
    route: "metadata-cleaner",
  },
  "security-scan": {
    ...PRO_SECURITY,
    processing: "server",
    route: "security-scan",
  },
  "website-monitoring": {
    ...PRO_SECURITY,
    processing: "server",
    route: "website-monitoring",
  },
};

export function getToolAccess(toolId: string): ToolAccessConfig | undefined {
  return TOOL_ACCESS[toolId];
}

export function getAnonymousUploadLimit(): number {
  return getPlanLimits("free").maxUploadBytes;
}

export function validateAnonymousUploadSize(
  toolId: string,
  bytes: number | undefined,
): string | null {
  const access = getToolAccess(toolId);
  if (!access) {
    return "Unknown tool.";
  }

  if (bytes === undefined || bytes <= 0) {
    return null;
  }

  const maxBytes = getAnonymousUploadLimit();
  if (bytes > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return `File exceeds the ${maxMb}MB free upload limit.`;
  }

  return null;
}

export function isFreeTool(toolId: string): boolean {
  const access = getToolAccess(toolId);
  return Boolean(access && !access.requiresAuth && !access.requiresPro);
}
