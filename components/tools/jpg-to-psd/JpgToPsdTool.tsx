"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import "@/styles/image-conversion-premium.css";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";
import { submitImageToolForm, type ImageToolStats as Stats } from "@/lib/tools/image/client";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import { FREE_IMAGE_MAX_BYTES } from "@/lib/tools/shared/image-validate";
import type { ToolStatus } from "@/lib/tools/types";

const ACCEPT_IMAGES = ".jpg,.jpeg,image/jpeg";
const MAX_BYTES = FREE_IMAGE_MAX_BYTES;
const MAX_MB = Math.round(MAX_BYTES / (1024 * 1024));
const PRIVACY_MESSAGE =
  "Images are processed on Scanonix servers and deleted after processing.";

const ALLOWED_EXT = new Set(["jpg", "jpeg"]);

function isSupportedJpeg(file: File): boolean {
  if (file.size <= 0 || file.size > MAX_BYTES) return false;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ALLOWED_EXT.has(ext)) return true;
  const type = file.type.toLowerCase();
  return type === "image/jpeg" || type === "image/jpg";
}

function ConvertDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <ImageIcon className={className} aria-hidden="true" strokeWidth={1.75} />;
}

export function JpgToPsdTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>();
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFileName, setResultFileName] = useState<string>();
  const [stats, setStats] = useState<Stats>();
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [message, setMessage] = useState<string>();
  const previewUrlRef = useRef<string | undefined>(undefined);

  const isBusy = status === "loading";
  const hasResult = status === "success" && resultBlob !== null;

  const setFilePreview = useCallback((image: File | null) => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return undefined;
    });

    if (!image) {
      previewUrlRef.current = undefined;
      setNaturalSize(undefined);
      return;
    }

    const url = URL.createObjectURL(image);
    previewUrlRef.current = url;
    setPreviewUrl(url);

    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const handleConvert = useCallback(async () => {
    if (!file || isBusy) return;

    const attempt = createProcessAttempt("jpg-to-psd");
    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setMessage("Converting JPG into a PSD file…");
    setResultBlob(null);
    setStats(undefined);

    const formData = new FormData();
    formData.append("file", file);

    const result = await submitImageToolForm("/api/tools/jpg-to-psd", formData);
    if (!result.ok) {
      attempt.error(planErrorMessageToCode(result.message));
      setStatus("error");
      setMessage(result.message);
      return;
    }

    setResultBlob(result.blob);
    setResultFileName(result.fileName);
    setStats({
      ...result.stats,
      originalSize: result.stats.originalSize || file.size,
    });
    attempt.success(1);
    setStatus("success");
    setMessage("PSD ready!");
  }, [file, isBusy]);

  const handleDownload = useCallback(() => {
    if (!resultBlob) return;
    downloadBlob(
      resultBlob,
      resultFileName ?? "image.psd",
      buildToolDownloadMeta("jpg-to-psd", 1),
    );
    setStatus("success");
    setMessage("PSD downloaded successfully!");
  }, [resultBlob, resultFileName]);

  const resetTool = useCallback(() => {
    setFilePreview(null);
    setFile(null);
    setResultBlob(null);
    setResultFileName(undefined);
    setStats(undefined);
    setStatus("idle");
    setMessage(undefined);
  }, [setFilePreview]);

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (file) return "ready";
    return "idle";
  }, [status, hasResult, file]);

  return (
    <div className="image-conversion-premium space-y-5 overflow-x-hidden">
      <ToolStatusBanner status={status} message={message} />
      <ToolWorkspaceShell
        isEmpty={!file}
        empty={
          <>
            <FileDropZone
              className="image-conv-drop"
              accept={ACCEPT_IMAGES}
              multiple={false}
              label="Drop a JPG to convert"
              hint={`JPG \u2014 up to ${MAX_MB}MB \u00B7 Output is a single raster layer PSD`}
              disabled={isBusy}
              validateFile={isSupportedJpeg}
              icon={<ConvertDropIcon />}
              onInvalidFiles={() => {
                setMessage(`Please choose a JPG/JPEG image up to ${MAX_MB}MB.`);
                setStatus("error");
              }}
              onFilesSelected={(files) => {
                const image = files[0];
                if (image) {
                  setFilePreview(image);
                  setFile(image);
                  setResultBlob(null);
                  setResultFileName(undefined);
                  setStats(undefined);
                  setStatus("idle");
                  setMessage(undefined);
                }
              }}
            />
            <div className="image-conv-privacy">
              <PrivacyNotice message={PRIVACY_MESSAGE} />
            </div>
          </>
        }
        workArea={
          file ? (
            <div className="image-conv-simple">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center text-scanonix-orange">
                    <ConvertDropIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
                    <p className="truncate text-xs text-scanonix-muted">
                      {formatFileSize(file.size)}
                      {naturalSize ? ` \u00B7 ${naturalSize.width} \u00D7 ${naturalSize.height}px` : ""}
                    </p>
                  </div>
                </div>
                <div className={hasResult ? "hidden shrink-0 lg:block" : "shrink-0"}>
                  <ActionButton variant="outline" size="sm" className="rounded-lg" disabled={isBusy} onClick={resetTool}>
                    {hasResult ? "Convert another" : "Replace image"}
                  </ActionButton>
                </div>
              </div>
              {previewUrl ? (
                <div className="image-conv-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Original JPG preview" />
                </div>
              ) : null}
              {hasResult && resultBlob && stats ? (
                <div className="mt-4 space-y-4">
                  <dl className="image-conv-stats text-sm">
                    {naturalSize ? (
                      <div>
                        <dt className="text-scanonix-muted">Source</dt>
                        <dd className="font-semibold text-foreground">{naturalSize.width} {"\u00D7"} {naturalSize.height}px</dd>
                      </div>
                    ) : null}
                    {stats.width && stats.height ? (
                      <div>
                        <dt className="text-scanonix-muted">PSD size</dt>
                        <dd className="font-semibold text-foreground">{stats.width} {"\u00D7"} {stats.height}px</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="text-scanonix-muted">Original file</dt>
                      <dd className="font-semibold text-foreground">{formatFileSize(stats.originalSize)}</dd>
                    </div>
                    <div>
                      <dt className="text-scanonix-muted">PSD file</dt>
                      <dd className="font-semibold text-foreground">{formatFileSize(stats.outputSize)}</dd>
                    </div>
                    <div>
                      <dt className="text-scanonix-muted">Color mode</dt>
                      <dd className="font-semibold text-foreground">RGB 8-bit</dd>
                    </div>
                    <div>
                      <dt className="text-scanonix-muted">Layers</dt>
                      <dd className="font-semibold text-foreground">1 raster layer</dd>
                    </div>
                    {resultFileName ? (
                      <div>
                        <dt className="shrink-0 text-scanonix-muted">Filename</dt>
                        <dd className="min-w-0 truncate font-semibold text-foreground">{resultFileName}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <p className="text-sm leading-relaxed text-scanonix-muted">
                    JPG files do not contain editable Photoshop layers, text, or smart objects, so those cannot be reconstructed.
                  </p>
                  <div className="hidden lg:block">
                    <ActionButton size="lg" className="h-12 w-full shadow-[var(--shadow-orange-sm)]" onClick={handleDownload}>
                      Download PSD
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <p className="text-sm leading-relaxed text-foreground">
                    Convert JPG images into PSD files with your image on a single raster layer. Output is a standard PSD with one raster layer, not editable design layers recovered from the JPG.
                  </p>
                  <div className="hidden lg:block">
                    <ActionButton
                      size="lg"
                      className="h-12 w-full shadow-[var(--shadow-orange-sm)]"
                      loading={isBusy}
                      disabled={!file || isBusy}
                      onClick={() => { void handleConvert(); }}
                    >
                      {isBusy ? "Converting\u2026" : "Convert to PSD"}
                    </ActionButton>
                  </div>
                </div>
              )}
              <div className="image-conv-privacy mt-4">
                <PrivacyNotice message={PRIVACY_MESSAGE} />
              </div>
            </div>
          ) : null
        }
      />
      <ToolStickyMobileActionBar
        visible={Boolean(file)}
        stickyUntil="lg"
        phase={resultActionPhase}
        primaryLabel={hasResult ? "Download PSD" : "Convert to PSD"}
        primaryLoading={!hasResult && isBusy}
        primaryDisabled={hasResult ? isBusy || !resultBlob : !file || isBusy}
        showPrimaryOnError
        onPrimaryClick={() => { if (hasResult) handleDownload(); else void handleConvert(); }}
        onStartOver={hasResult ? resetTool : undefined}
        startOverLabel="Convert another"
        startOverDisabled={isBusy}
      />
    </div>
  );
}
