const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function upscaleJobBasePath(userId: string, jobId: string): string {
  return `${userId}/upscale-jobs/${jobId}`;
}

export function upscaleJobInputPath(userId: string, jobId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  return `${upscaleJobBasePath(userId, jobId)}/input.${safeExt}`;
}

export function upscaleJobOutputPath(userId: string, jobId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  return `${upscaleJobBasePath(userId, jobId)}/output.${safeExt}`;
}

export function storageExtFromMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  return MIME_TO_EXT[normalized] ?? "jpg";
}

export function upscaleJobStoragePaths(userId: string, jobId: string): string[] {
  const base = upscaleJobBasePath(userId, jobId);
  return [`${base}/input.jpg`, `${base}/input.png`, `${base}/input.webp`, `${base}/input.heic`, `${base}/input.heif`];
}
