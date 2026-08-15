/**
 * Digital signature detection for Watermark PDF (Phase 124B).
 * Reuses Fill PDF byte-pattern scan — signatures may be invalidated by re-save.
 */

export {
  detectExistingDigitalSignatures,
} from "@/lib/tools/fill-pdf/detect-form";
