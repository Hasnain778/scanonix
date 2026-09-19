import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";

/**
 * Full-viewport chrome for Image Editor (public + dev).
 * Intentionally omits site Footer and long-page SEO layout.
 */
export function ImageEditorPageFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="pt-16" data-editor-page-offset="">
        <main className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-[1600px] flex-col px-2 py-2 sm:px-3 lg:px-4">
          {children}
        </main>
      </div>
    </>
  );
}
