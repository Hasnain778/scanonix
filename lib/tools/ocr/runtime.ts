import type { WorkerOptions } from "tesseract.js";
import { OcrExtractionError } from "./languages";

/**
 * Same-origin runtime copied from the installed tesseract.js 7.0.0
 * and tesseract.js-core 7.0.0 LSTM builds. Paths are resolved against
 * the page origin by tesseract.js.
 */
export const OCR_RUNTIME_WORKER_PATH = "/ocr-runtime/worker.min.js";
export const OCR_RUNTIME_CORE_PATH = "/ocr-runtime/core";
export const OCR_RUNTIME_LANG_PATH = "/ocr-runtime/lang";

/**
 * WASM compile plus the first same-origin language fetch on a slow device.
 * Local assets usually finish in a few seconds. 90s still ends a hung init.
 */
export const OCR_INIT_TIMEOUT_MS = 90_000;

/**
 * One image or one PDF page after the 16-megapixel preprocess cap.
 * A cold page on a slow CPU can take well over a minute. 3 minutes is
 * bounded without cutting off a legitimate first recognition.
 */
export const OCR_RECOGNIZE_TIMEOUT_MS = 180_000;

const OCR_START_MESSAGE = "OCR couldn't start. Please try again.";
const OCR_FINISH_MESSAGE = "OCR couldn't finish reading this file. Please try again.";

export class OcrTimeoutError extends OcrExtractionError {
  readonly phase: "init" | "recognize";

  constructor(phase: "init" | "recognize") {
    super("OCR_FAILURE", phase === "init" ? OCR_START_MESSAGE : OCR_FINISH_MESSAGE);
    this.name = "OcrTimeoutError";
    this.phase = phase;
  }
}

export function getOcrWorkerOptions(): Partial<WorkerOptions> {
  return {
    workerPath: OCR_RUNTIME_WORKER_PATH,
    corePath: OCR_RUNTIME_CORE_PATH,
    langPath: OCR_RUNTIME_LANG_PATH,
    gzip: true,
    errorHandler: (error: unknown) => {
      console.error("[ocr] worker reported an error", error);
    },
  };
}

export function withOcrDeadline<T>(
  work: Promise<T>,
  timeoutMs: number,
  phase: "init" | "recognize",
  onLate?: (value: T) => void,
): Promise<T> {
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new OcrTimeoutError(phase));
    }, timeoutMs);
  });

  void work.then(
    (value) => {
      if (timedOut) onLate?.(value);
    },
    (error: unknown) => {
      if (timedOut) {
        console.error("[ocr] worker failed after the deadline", error);
      }
    },
  );

  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
