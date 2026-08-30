"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ResultActionBar } from "@/components/tools/ResultActionBar";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { createProcessAttempt } from "@/lib/analytics/process-lifecycle";
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
} from "@/lib/tools/sign-pdf/types";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";
import { PdfPageEditor } from "./PdfPageEditor";
import {
  SignatureAssetPalette,
  type SignatureAssetEntry,
} from "./SignatureAssetPalette";
import { SignatureCreatorModal } from "./SignatureCreatorModal";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

interface UploadedPdfState {
  file: File;
  bytes: ArrayBuffer;
  pageCount: number;
  pageGeometries: PageGeometry[];
}

const PRIVACY_MESSAGE =
  "Your PDF and signature are processed locally in your browser and are not uploaded to Scanonix servers.";

function PdfDropIcon() {
  return (
    <svg
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M12 9v6" />
    </svg>
  );
}

export function SignPdfTool() {
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [assets, setAssets] = useState<SignatureAssetEntry[]>([]);
  const [placements, setPlacements] = useState<NormalizedPlacement[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
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
  const canExport = uploadedPdf !== null && canExportSignPdf(placements) && !isBusy;
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

  const handleUpload = useCallback(async (files: File[]) => {
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
  }, [revokeAssetUrls]);

  const handleAssetCreated = useCallback(
    async (asset: SignatureAsset) => {
      try {
        const previewUrl = URL.createObjectURL(
          new Blob([Uint8Array.from(asset.bytes)], { type: asset.mimeType }),
        );
        assetUrlsRef.current.push(previewUrl);
        const aspectRatio = await getSignatureAssetAspectRatio(
          asset.bytes,
          asset.mimeType,
        );
        setAssets((current) => [
          ...current,
          { asset, previewUrl, aspectRatio },
        ]);
        setSelectedAssetId(asset.id);
        setStatus("idle");
        setStatusMessage("Signature created. Select it and add to the current page.");
      } catch (error) {
        setStatus("error");
        setStatusMessage(
          error instanceof Error ? error.message : "Could not prepare signature preview.",
        );
      }
    },
    [],
  );

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
      setStatusMessage(`Signature added to page ${currentPage}. Drag it to the desired position.`);
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

  const currentPagePlacements = uploadedPdf
    ? getPlacementsForPage(placements, currentPage - 1)
    : [];

  return (
    <div className="space-y-8">
      <ToolStatusBanner
        status={isReadingPdf ? "loading" : status}
        message={isReadingPdf ? "Reading PDF…" : statusMessage}
      />

      {!uploadedPdf && (
        <>
          <FileDropZone
            onFilesSelected={handleUpload}
            accept={ACCEPTED_PDF_EXTENSIONS}
            validateFile={isAcceptedPdfFile}
            multiple={false}
            disabled={isBusy}
            label="Drop a PDF file here to sign"
            hint="or click to browse — processed locally in your browser"
            icon={<PdfDropIcon />}
          />
          <PrivacyNotice message={PRIVACY_MESSAGE} />
        </>
      )}

      {uploadedPdf && (
        <>
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-muted text-scanonix-orange">
                <PdfDropIcon />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {uploadedPdf.file.name}
                </p>
                <p className="mt-1 text-sm text-foreground-muted">
                  {formatFileSize(uploadedPdf.file.size)} · {uploadedPdf.pageCount}{" "}
                  page{uploadedPdf.pageCount === 1 ? "" : "s"} ·{" "}
                  {placements.length} placement{placements.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <ActionButton
              variant="outline"
              className="w-full sm:w-auto"
              disabled={isBusy}
              onClick={resetWorkspace}
            >
              Choose another PDF
            </ActionButton>
          </div>

          <SignatureAssetPalette
            assets={assets}
            selectedAssetId={selectedAssetId}
            disabled={isBusy}
            onSelectAsset={setSelectedAssetId}
            onAddToPage={handleAddToPage}
            onCreateSignature={() => setIsCreatorOpen(true)}
          />

          <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Page editor</h2>
                <p className="mt-1 text-sm text-foreground-muted">
                  Page {currentPage} of {uploadedPdf.pageCount}
                  {currentPagePlacements.length > 0
                    ? ` · ${currentPagePlacements.length} signature${currentPagePlacements.length === 1 ? "" : "s"} on this page`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ActionButton
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1 || isBusy}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
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
                  onChange={(event) => setCurrentPage(Number(event.target.value))}
                  className="select-field w-auto min-w-[8.5rem] px-3 py-2 text-sm"
                >
                  {Array.from({ length: uploadedPdf.pageCount }, (_, index) => index + 1).map(
                    (page) => (
                      <option key={page} value={page}>
                        Page {page}
                      </option>
                    ),
                  )}
                </select>
                <ActionButton
                  variant="outline"
                  size="sm"
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

          {hasResult && resultBlob && (
            <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <h2 className="mb-2 text-lg font-semibold text-foreground">Results</h2>
              <p className="text-sm text-foreground-muted">
                {placements.length} signature{placements.length === 1 ? "" : "s"} embedded ·{" "}
                {formatFileSize(resultBlob.size)} · {resultFilename}
              </p>
              <div className="mt-5">
                <ResultActionBar
                  phase={resultActionPhase}
                  primary={{
                    label: "Download signed PDF",
                    onClick: () => {
                      void handleDownload();
                    },
                    loading: isDownloading,
                    disabled: isBusy,
                  }}
                  startOver={{
                    label: "Start over",
                    onClick: resetWorkspace,
                    disabled: isBusy,
                  }}
                />
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Export signed PDF</h2>
                <p className="mt-1 text-sm text-foreground-muted">
                  {canExport
                    ? "Export embeds your signatures into a new PDF for download."
                    : "Add at least one signature placement before exporting."}
                </p>
              </div>
              <ActionButton
                size="lg"
                className="w-full sm:w-auto"
                loading={isExporting}
                disabled={!canExport}
                onClick={handleExport}
              >
                {isExporting ? "Exporting…" : "Export signed PDF"}
              </ActionButton>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <PrivacyNotice message={PRIVACY_MESSAGE} />
            </div>
          </div>
        </>
      )}

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
