import type { Metadata } from "next";
import { ImageEditorPageFrame } from "@/components/image-editor/ImageEditorPageFrame";
import { ImageEditorWorkspace } from "@/components/image-editor/ImageEditorWorkspace";

export const metadata: Metadata = {
  title: "Image Editor Prototype (Dev) | Scanonix",
  description: "Local-only Image Editor engine prototype. Not a public product.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

/**
 * Dev-only Image Editor route. Shares the same workspace as /tools/image-editor.
 * Remains noindex / out of sitemap / out of discovery.
 */
export default function DevImageEditorPage() {
  return (
    <ImageEditorPageFrame>
      <ImageEditorWorkspace />
    </ImageEditorPageFrame>
  );
}
