import { ImageEditorPageFrame } from "@/components/image-editor/ImageEditorPageFrame";
import { ImageEditorWorkspace } from "@/components/image-editor/ImageEditorWorkspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("image-editor");

/**
 * Canonical public Image Editor.
 * Full-viewport application shell — no site footer or below-fold SEO chrome.
 */
export default function ImageEditorPage() {
  return (
    <ImageEditorPageFrame>
      <ImageEditorWorkspace />
    </ImageEditorPageFrame>
  );
}
