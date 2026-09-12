"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Signature } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolControlPanel } from "@/components/workspace/ToolControlPanel";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import { createProcessAttempt } from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";
import { getAnonymousUploadLimit } from "@/lib/plan/tool-access";
import { isAcceptedPdfFile } from "@/lib/pdf/core";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import {
  canExportSignPdf,
  createDefaultPlacement,
  getPlacementsForPage,
} from "@/lib/tools/sign-pdf/placement-ui";
import {
  getSignatureAssetAspectRatio,
  loadSignPdfDocumentMetadata,
} from "@/lib/tools/sign-pdf/pdf-metadata";
import { buildSignedPdfFilename, signPdfDocument } from "@/lib/tools/sign-pdf/sign-pdf";
import { MAX_SIGNATURE_PLACEMENTS } from "@/lib/tools/sign-pdf/limits";
import {
  SignPdfError,
  getSignPdfErrorMessage,
  type NormalizedPlacement,
  type PageGeometry,
  type SignatureAsset,
  type SignatureSourceType,
} from "@/lib/tools/sign-pdf/types";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";
import { PdfPageEditor } from "./PdfPageEditor";
import type { SignatureAssetEntry } from "./SignatureAssetPalette";
import { SignatureCreatorModal } from "./SignatureCreatorModal";

interface UploadedPdfState {
  file: File;
  bytes: ArrayBuffer;
  pageCount: number;
  pageGeometries: PageGeometry[];
}

const PRIVACY_MESSAGE =
  "Your PDF and signature are processed locally in your browser and are not uploaded to Scanonix servers.";

const VISUAL_SIGNATURE_NOTE =
  "Adds your signature appearance to the PDF. This does not create a certificate-based digital signature.";

function SignDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <Signature className={className} aria-hidden="true" strokeWidth={1.75} />;
}

function sourceLabel(sourceType: SignatureSourceType): string {
  switch (sourceType) {
    case "draw":
      return "Drawn";
    case "type":
      return "Typed";
    case "upload":
      return "Uploaded";
  }
}

export function SignPdfTool() {
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [assets, setAssets] = useState<SignatureAssetEntry[]>([]);
  const [placements, setPlacements] = useState<NormalizedPlacement[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(
    null,
  );
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFilename, setResultFilename] = useState("scanonix-signed.pdf");
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const resultBlobRef = useRef<Blob | null>(null);
  const assetUrlsRef = useRef<string[]>([]);

  const isBusy = isReadingPdf || isExporting || isDownloading;
  const hasResult = resultBlob !== null && status === "success";
  const canExport =
    uploadedPdf !== null && canExportSignPdf(placements) && !isBusy;
  const pageCount = uploadedPdf?.pageCount ?? 0;

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (isExporting || isReadingPdf) return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (uploadedPdf !== null && pageCount > 0) return "ready";
    return "idle";
  }, [isExporting, isReadingPdf, hasResult, status, uploadedPdf, pageCount]);

  const stickyVisible = Boolean(
    uploadedPdf && (hasResult || canExport || isExporting),
  );

  const assetMap = useMemo(() => {
    const map: Record<string, { previewUrl: string; aspectRatio: number }> = {};
    for (const entry of assets) {
      map[entry.asset.id] = {
        previewUrl: entry.previewUrl,
        aspectRatio: entry.aspectRatio,
      };
    }
    return map;
  }, [assets]);

  const currentPagePlacements = uploadedPdf
    ? getPlacementsForPage(placements, currentPage - 1)
    : [];

  const pagesWithSignatures = useMemo(() => {
    const pages = new Set(placements.map((placement) => placement.pageIndex));
    return pages.size;
  }, [placements]);

  const revokeAssetUrls = useCallback(() => {
    for (const url of assetUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    assetUrlsRef.current = [];
  }, []);

  useEffect(() => {
    resultBlobRef.current = resultBlob;
  }, [resultBlob]);

  useEffect(() => {
    return () => {
      revokeAssetUrls();
      resultBlobRef.current = null;
    };
  }, [revokeAssetUrls]);

  const resetWorkspace = useCallback(() => {
    revokeAssetUrls();
    setUploadedPdf(null);
    setCurrentPage(1);
    setAssets([]);
    setPlacements([]);
    setSelectedAssetId(null);
    setSelectedPlacementId(null);
    setResultBlob(null);
    setResultFilename("scanonix-signed.pdf");
    setStatus("idle");
    setStatusMessage(undefined);
    setIsExporting(false);
    setIsDownloading(false);
  }, [revokeAssetUrls]);

  const invalidateResult = useCallback(() => {
    resultBlobRef.current = null;
    setResultBlob(null);
    if (status === "success") {
      setStatus("idle");
      setStatusMessage(undefined);
    }
  }, [status]);

  const handleChangeSignatures = useCallback(() => {
    invalidateResult();
  }, [invalidateResult]);

  const handleUpload = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;

      if (file.size > getAnonymousUploadLimit()) {
        const maxMb = Math.round(getAnonymousUploadLimit() / (1024 * 1024));
        setStatus("error");
        setStatusMessage(`File exceeds the ${maxMb}MB upload limit.`);
        return;
      }

      setIsReadingPdf(true);
      setStatus("idle");
      setStatusMessage(undefined);
      revokeAssetUrls();
      setAssets([]);
      setPlacements([]);
      setSelectedAssetId(null);
      setSelectedPlacementId(null);
      setResultBlob(null);

      try {
        const bytes = await file.arrayBuffer();
        const metadata = await loadSignPdfDocumentMetadata(bytes);

        setUploadedPdf({
          file,
          bytes,
          pageCount: metadata.pageCount,
          pageGeometries: metadata.pageGeometries,
        });
        setCurrentPage(1);
        setResultFilename(buildSignedPdfFilename(file.name));
      } catch (error) {
        setUploadedPdf(null);
        setStatus("error");
        setStatusMessage(
          error instanceof SignPdfError
            ? error.message
            : getSignPdfErrorMessage(error),
        );
      } finally {
        setIsReadingPdf(false);
      }
    },
    [revokeAssetUrls],
  );

  const handleAssetCreated = useCallback(async (asset: SignatureAsset) => {
    try {
      const previewUrl = URL.createObjectURL(
        new Blob([Uint8Array.from(asset.bytes)], { type: asset.mimeType }),
      );
      assetUrlsRef.current.push(previewUrl);
      const aspectRatio = await getSignatureAssetAspectRatio(
        asset.bytes,
        asset.mimeType,
      );
      setAssets((current) => [...current, { asset, previewUrl, aspectRatio }]);
      setSelectedAssetId(asset.id);
      setStatus("idle");
      setStatusMessage(
        "Signature created. Select it and add to the current page.",
      );
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not prepare signature preview.",
      );
    }
  }, []);

  const handleAddToPage = useCallback(
    (assetId: string) => {
      if (!uploadedPdf) return;
      if (placements.length >= MAX_SIGNATURE_PLACEMENTS) {
        setStatus("error");
        setStatusMessage(
          `A maximum of ${MAX_SIGNATURE_PLACEMENTS} signature placements is supported.`,
        );
        return;
      }

      const entry = assets.find((item) => item.asset.id === assetId);
      if (!entry) return;

      invalidateResult();
      const placement = createDefaultPlacement({
        id: crypto.randomUUID(),
        pageIndex: currentPage - 1,
        signatureAssetId: assetId,
        assetAspectRatio: entry.aspectRatio,
      });

      setPlacements((current) => [...current, placement]);
      setSelectedPlacementId(placement.id);
      setSelectedAssetId(assetId);
      setStatus("idle");
      setStatusMessage(
        `Signature added to page ${currentPage}. Drag it to the desired position.`,
      );
    },
    [assets, currentPage, invalidateResult, placements.length, uploadedPdf],
  );

  const handleExport = async () => {
    if (!uploadedPdf || !canExport || isExporting) return;

    const attempt = createProcessAttempt("sign-pdf");
    if (!attempt?.markStarted()) return;

    setIsExporting(true);
    setStatus("loading");
    setStatusMessage("Creating signed PDF…");
    setResultBlob(null);

    try {
      const blob = await signPdfDocument(
        uploadedPdf.bytes,
        placements,
        assets.map((entry) => entry.asset),
        (current, total) => {
          setStatusMessage(`Embedding signatures (${current}/${total})…`);
        },
      );

      setResultBlob(blob);
      attempt.success(1);
      setStatus("success");
      setStatusMessage("Signed PDF ready to download.");
    } catch (error) {
      attempt.error("unknown");
      setStatus("error");
      setStatusMessage(
        error instanceof SignPdfError
          ? error.message
          : getSignPdfErrorMessage(error),
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = async () => {
    const blob = resultBlobRef.current ?? resultBlob;
    if (!blob || isDownloading) return;

    setIsDownloading(true);
    try {
      downloadBlob(blob, resultFilename, buildToolDownloadMeta("sign-pdf", 1));
    } finally {
      setIsDownloading(false);
    }
  };

  const exportHint = !canExport
    ? "Add at least one signature placement before exporting."
    : isExporting
      ? "Creating signed PDF…"
      : `Ready to export · ${placements.length} placement${placements.length === 1 ? "" : "s"}.`;

  const selectedAsset =
    assets.find((entry) => entry.asset.id === selectedAssetId) ?? null;

  return (
    <div className="space-y-5 overflow-x-hidden">
      <ToolStatusBanner
        status={isReadingPdf ? "loading" : status}
        message={isReadingPdf ? "Reading PDF…" : statusMessage}
      />

      <ToolWorkspaceShell
        isEmpty={!uploadedPdf}
        empty={
          <>
            <FileDropZone
              onFilesSelected={handleUpload}
              accept={ACCEPTED_PDF_EXTENSIONS}
              validateFile={isAcceptedPdfFile}
              multiple={false}
              disabled={isBusy}
              label="Drop a PDF file here to sign"
              hint="or click to browse — processed locally in your browser"
              icon={<SignDropIcon />}
            />
            <PrivacyNotice message={PRIVACY_MESSAGE} />
          </>
        }
        workArea={
          uploadedPdf ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                    <SignDropIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {uploadedPdf.file.name}
                    </p>
                    <p className="truncate text-[11px] text-scanonix-muted">
                      {formatFileSize(uploadedPdf.file.size)} · {pageCount} page
                      {pageCount === 1 ? "" : "s"}
                      {placements.length > 0
                        ? ` · ${placements.length} placement${placements.length === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div
                  className={
                    stickyVisible
                      ? "hidden w-full sm:w-auto md:block"
                      : "w-full sm:w-auto"
                  }
                >
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg sm:w-auto"
                    disabled={isBusy}
                    onClick={resetWorkspace}
                  >
                    {hasResult ? "Start over" : "Choose another PDF"}
                  </ActionButton>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-surface px-3 py-2 sm:px-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Page {currentPage} of {pageCount}
                  </p>
                  <p className="text-[11px] text-scanonix-muted">
                    {currentPagePlacements.length > 0
                      ? `${currentPagePlacements.length} signature${currentPagePlacements.length === 1 ? "" : "s"} on this page`
                      : "No signatures on this page"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={currentPage <= 1 || isBusy}
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                  >
                    Previous
                  </ActionButton>
                  <label className="sr-only" htmlFor="sign-pdf-page-select">
                    Select page
                  </label>
                  <select
                    id="sign-pdf-page-select"
                    value={currentPage}
                    disabled={isBusy}
                    onChange={(event) =>
                      setCurrentPage(Number(event.target.value))
                    }
                    className="select-field w-auto min-w-[8.5rem] px-3 py-2 text-sm"
                  >
                    {Array.from(
                      { length: uploadedPdf.pageCount },
                      (_, index) => index + 1,
                    ).map((page) => (
                      <option key={page} value={page}>
                        Page {page}
                      </option>
                    ))}
                  </select>
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={currentPage >= uploadedPdf.pageCount || isBusy}
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(uploadedPdf.pageCount, page + 1),
                      )
                    }
                  >
                    Next
                  </ActionButton>
                </div>
              </div>

              <div className="bg-surface-muted/30 p-3 sm:p-4">
                <PdfPageEditor
                  pageNumber={currentPage}
                  pdfBytes={uploadedPdf.bytes}
                  placements={placements}
                  assets={assetMap}
                  selectedPlacementId={selectedPlacementId}
                  disabled={isBusy}
                  onSelectPlacement={setSelectedPlacementId}
                  onUpdatePlacement={(placement) => {
                    invalidateResult();
                    setPlacements((current) =>
                      current.map((item) =>
                        item.id === placement.id ? placement : item,
                      ),
                    );
                  }}
                  onDeletePlacement={(placementId) => {
                    invalidateResult();
                    setPlacements((current) =>
                      current.filter((item) => item.id !== placementId),
                    );
                    setSelectedPlacementId((current) =>
                      current === placementId ? null : current,
                    );
                  }}
                />
              </div>
            </div>
          ) : null
        }
        controlPanel={
          uploadedPdf ? (
            <ToolControlPanel
              aria-label="Sign PDF controls"
              footer={
                hasResult && resultBlob ? (
                  <div className="flex flex-col gap-2">
                    <div className="hidden md:block">
                      <ActionButton
                        size="lg"
                        className="w-full"
                        loading={isDownloading}
                        disabled={isBusy}
                        onClick={() => {
                          void handleDownload();
                        }}
                      >
                        Download signed PDF
                      </ActionButton>
                    </div>
                    <ActionButton
                      variant="outline"
                      size="lg"
                      className="w-full"
                      disabled={isBusy}
                      onClick={handleChangeSignatures}
                    >
                      Change signatures
                    </ActionButton>
                    <div className="hidden md:block">
                      <ActionButton
                        variant="outline"
                        size="lg"
                        className="w-full"
                        disabled={isBusy}
                        onClick={resetWorkspace}
                      >
                        Start over
                      </ActionButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] leading-snug text-scanonix-muted">
                      {exportHint}
                    </p>
                    <div
                      className={
                        stickyVisible ? "hidden md:block" : undefined
                      }
                    >
                      <ActionButton
                        size="lg"
                        className="w-full shadow-[var(--shadow-orange-sm)]"
                        loading={isExporting}
                        disabled={!canExport}
                        onClick={() => {
                          void handleExport();
                        }}
                      >
                        {isExporting ? "Exporting…" : "Export signed PDF"}
                      </ActionButton>
                    </div>
                    <div
                      className={
                        stickyVisible ? "hidden md:block" : undefined
                      }
                    >
                      <ActionButton
                        variant="outline"
                        size="lg"
                        className="w-full"
                        disabled={isBusy}
                        onClick={resetWorkspace}
                      >
                        Start over
                      </ActionButton>
                    </div>
                  </div>
                )
              }
            >
              {hasResult && resultBlob ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Result
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-green-700 dark:text-green-400">
                      ✓ PDF signed
                    </p>
                    <p className="mt-1 text-xs text-scanonix-muted">
                      Your signed PDF is ready to download.
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Signatures</dt>
                      <dd className="font-semibold text-foreground">
                        {placements.length}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Pages signed</dt>
                      <dd className="font-semibold text-foreground">
                        {pagesWithSignatures} of {pageCount}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Output size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(resultBlob.size)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Format</dt>
                      <dd className="font-semibold text-foreground">PDF</dd>
                    </div>
                    <div className="min-w-0 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Filename</dt>
                      <dd className="mt-0.5 truncate font-semibold text-foreground">
                        {resultFilename}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Sign PDF
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-scanonix-muted">
                      Create a signature, then place it on your PDF.
                    </p>
                  </div>

                  <section className="space-y-2.5">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Signature
                    </h2>
                    <p className="text-xs text-scanonix-muted">
                      Draw, type, or upload — reusable during this session.
                    </p>
                    <ActionButton
                      variant="outline"
                      size="sm"
                      className="w-full justify-center rounded-md"
                      disabled={isBusy}
                      onClick={() => setIsCreatorOpen(true)}
                    >
                      Create signature
                    </ActionButton>

                    {assets.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-scanonix-muted">
                        No signatures yet. Create one to place on the PDF.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {assets.map((entry) => {
                          const isSelected =
                            selectedAssetId === entry.asset.id;
                          return (
                            <li key={entry.asset.id}>
                              <button
                                type="button"
                                aria-pressed={isSelected}
                                disabled={isBusy}
                                onClick={() =>
                                  setSelectedAssetId(entry.asset.id)
                                }
                                className={`flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition-colors ${
                                  isSelected
                                    ? "border-scanonix-orange bg-scanonix-orange/10 ring-2 ring-scanonix-orange/30"
                                    : "border-border bg-surface-muted/60 hover:border-scanonix-orange/40"
                                }`}
                              >
                                <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md border border-border bg-[repeating-conic-gradient(#ffffff10_0%_25%,transparent_0%_50%)] bg-[length:12px_12px] p-1.5">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={entry.previewUrl}
                                    alt=""
                                    className="max-h-full max-w-full object-contain"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground">
                                    {sourceLabel(entry.asset.sourceType)}{" "}
                                    signature
                                  </p>
                                  <p className="text-[11px] text-scanonix-muted">
                                    Session only
                                  </p>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <ActionButton
                      size="sm"
                      className="w-full justify-center rounded-md"
                      disabled={isBusy || !selectedAsset}
                      onClick={() => {
                        if (selectedAsset) {
                          handleAddToPage(selectedAsset.asset.id);
                        }
                      }}
                    >
                      Add to page
                    </ActionButton>
                    <p className="text-[11px] leading-snug text-scanonix-muted">
                      Drag to position · use the corner handle to resize
                    </p>
                  </section>

                  <section className="space-y-2.5 border-t border-border/80 pt-4">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Pages
                    </h2>
                    <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Current page</dt>
                        <dd className="font-semibold text-foreground">
                          {currentPagePlacements.length}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Document</dt>
                        <dd className="font-semibold text-foreground">
                          {placements.length} / {MAX_SIGNATURE_PLACEMENTS}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Page</dt>
                        <dd className="font-semibold text-foreground">
                          {currentPage} / {pageCount}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="space-y-2 border-t border-border/80 pt-4">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Visual signature
                    </h2>
                    <p className="rounded-lg border border-border bg-surface-muted/60 px-3 py-2 text-xs leading-relaxed text-foreground">
                      {VISUAL_SIGNATURE_NOTE}
                    </p>
                    <PrivacyNotice message={PRIVACY_MESSAGE} />
                  </section>
                </div>
              )}
            </ToolControlPanel>
          ) : null
        }
      />

      {/*
        Dual-phase sticky (opt-in phase API):
        ready/processing → Export signed PDF (+ Choose another PDF)
        success → Download signed PDF + Start over
      */}
      <ToolStickyMobileActionBar
        visible={stickyVisible}
        phase={resultActionPhase}
        primaryLabel={hasResult ? "Download signed PDF" : "Export signed PDF"}
        primaryLoading={hasResult ? isDownloading : isExporting}
        primaryDisabled={hasResult ? isBusy || !resultBlob : !canExport}
        onPrimaryClick={() => {
          if (hasResult) {
            void handleDownload();
          } else {
            void handleExport();
          }
        }}
        secondaryLabel={
          resultActionPhase === "ready" && uploadedPdf
            ? "Choose another PDF"
            : undefined
        }
        onSecondaryClick={
          resultActionPhase === "ready" && uploadedPdf
            ? resetWorkspace
            : undefined
        }
        secondaryDisabled={isBusy}
        onStartOver={hasResult ? resetWorkspace : undefined}
        startOverLabel="Start over"
        startOverDisabled={isBusy}
      />

      <SignatureCreatorModal
        open={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        onCreated={handleAssetCreated}
      />
    </div>
  );
}
