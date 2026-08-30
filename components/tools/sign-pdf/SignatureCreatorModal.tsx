"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import {
  SIGNATURE_TYPED_FONT_STYLES,
  createTypedSignatureAsset,
  normalizeUploadedSignatureFile,
  validateSignatureImageFile,
  type SignatureTypedFontStyleId,
} from "@/lib/tools/sign-pdf/signature-assets";
import type { SignatureAsset } from "@/lib/tools/sign-pdf/types";
import { SignatureDrawPad } from "./SignatureDrawPad";

type SignatureTab = "draw" | "type" | "upload";

interface SignatureCreatorModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (asset: SignatureAsset) => void;
}

export function SignatureCreatorModal({
  open,
  onClose,
  onCreated,
}: SignatureCreatorModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<SignatureTab>("draw");
  const [typedName, setTypedName] = useState("");
  const [fontStyleId, setFontStyleId] =
    useState<SignatureTypedFontStyleId>("script");
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = useCallback(() => {
    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl);
    }
    setTab("draw");
    setTypedName("");
    setFontStyleId("script");
    setUploadFile(null);
    setUploadPreviewUrl(null);
    setError(undefined);
    onClose();
  }, [onClose, uploadPreviewUrl]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, open]);

  useEffect(() => {
    return () => {
      if (uploadPreviewUrl) {
        URL.revokeObjectURL(uploadPreviewUrl);
      }
    };
  }, [uploadPreviewUrl]);

  if (!open) {
    return null;
  }

  const selectedFont =
    SIGNATURE_TYPED_FONT_STYLES.find((style) => style.id === fontStyleId) ??
    SIGNATURE_TYPED_FONT_STYLES[0];

  const handleUploadChange = (file: File | null) => {
    setError(undefined);
    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl);
      setUploadPreviewUrl(null);
    }
    setUploadFile(null);

    if (!file) return;

    const validationError = validateSignatureImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploadFile(file);
    setUploadPreviewUrl(URL.createObjectURL(file));
  };

  const handleTypedAdd = async () => {
    setIsSaving(true);
    setError(undefined);
    try {
      const asset = await createTypedSignatureAsset(
        typedName,
        crypto.randomUUID(),
        fontStyleId,
      );
      onCreated(asset);
      handleClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create signature.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadAdd = async () => {
    if (!uploadFile) return;
    setIsSaving(true);
    setError(undefined);
    try {
      const asset = await normalizeUploadedSignatureFile(
        uploadFile,
        crypto.randomUUID(),
      );
      onCreated(asset);
      handleClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load signature image.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-xl sm:p-6"
      >
        <h2 id={titleId} className="text-lg font-semibold text-foreground">
          Create signature
        </h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Draw, type, or upload a signature to place on your PDF.
        </p>

        <div
          className="mt-4 flex gap-2 border-b border-border pb-3"
          role="tablist"
          aria-label="Signature creation method"
        >
          {(
            [
              ["draw", "Draw"],
              ["type", "Type"],
              ["upload", "Upload"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                tab === value
                  ? "bg-scanonix-orange/15 text-scanonix-orange ring-2 ring-scanonix-orange/30"
                  : "text-foreground-muted hover:text-foreground"
              }`}
              onClick={() => {
                setTab(value);
                setError(undefined);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "draw" && (
            <SignatureDrawPad
              disabled={isSaving}
              onCancel={handleClose}
              onCreated={(asset) => {
                onCreated(asset);
                handleClose();
              }}
            />
          )}

          {tab === "type" && (
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">Your name</span>
                <input
                  type="text"
                  value={typedName}
                  onChange={(event) => setTypedName(event.target.value)}
                  className="input-field"
                  placeholder="Jane Doe"
                  autoComplete="name"
                />
              </label>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">Style</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {SIGNATURE_TYPED_FONT_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      aria-pressed={fontStyleId === style.id}
                      className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                        fontStyleId === style.id
                          ? "border-scanonix-orange bg-scanonix-orange/10"
                          : "border-border text-foreground-muted hover:border-scanonix-orange/40"
                      }`}
                      onClick={() => setFontStyleId(style.id)}
                    >
                      <span
                        style={{ fontFamily: style.font, color: "#111111" }}
                        className="text-base"
                      >
                        {typedName.trim() || "Signature"}
                      </span>
                      <span className="mt-1 block text-xs text-foreground-muted">{style.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="rounded-xl border border-border bg-surface-muted px-4 py-6 text-center">
                <span
                  style={{ fontFamily: selectedFont.font, color: "#111111" }}
                  className="text-3xl"
                >
                  {typedName.trim() || "Signature preview"}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <ActionButton variant="ghost" onClick={handleClose}>
                  Cancel
                </ActionButton>
                <ActionButton
                  className="ml-auto"
                  loading={isSaving}
                  disabled={!typedName.trim()}
                  onClick={handleTypedAdd}
                >
                  Add signature
                </ActionButton>
              </div>
            </div>
          )}

          {tab === "upload" && (
            <div className="space-y-4">
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="sr-only"
                onChange={(event) =>
                  handleUploadChange(event.target.files?.[0] ?? null)
                }
              />
              <ActionButton
                variant="outline"
                className="w-full"
                onClick={() => uploadInputRef.current?.click()}
              >
                Choose PNG or JPG
              </ActionButton>
              {uploadPreviewUrl && (
                <div className="flex justify-center rounded-xl border border-border bg-[repeating-conic-gradient(#ffffff10_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadPreviewUrl}
                    alt="Uploaded signature preview"
                    className="max-h-40 max-w-full object-contain"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <ActionButton variant="ghost" onClick={handleClose}>
                  Cancel
                </ActionButton>
                <ActionButton
                  className="ml-auto"
                  loading={isSaving}
                  disabled={!uploadFile}
                  onClick={handleUploadAdd}
                >
                  Add signature
                </ActionButton>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
