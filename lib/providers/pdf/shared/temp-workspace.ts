import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEMP_ROOT = join(tmpdir(), "scanonix-pdf-providers");

export interface TempWorkspace {
  dir: string;
  inputPath: string;
  outputPath: string;
  cleanup: () => Promise<void>;
}

export async function createTempWorkspace(
  input: Buffer,
  inputExtension = ".pdf",
): Promise<TempWorkspace> {
  const dir = join(TEMP_ROOT, randomUUID());
  await mkdir(dir, { recursive: true });

  const safeExt = inputExtension.replace(/[^a-z0-9.]/gi, "").slice(0, 10) || ".pdf";
  const inputPath = join(dir, `input-${randomUUID()}${safeExt}`);
  const outputPath = join(dir, `output-${randomUUID()}${safeExt}`);

  await writeFile(inputPath, input);

  return {
    dir,
    inputPath,
    outputPath,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export async function withTempWorkspace<T>(
  input: Buffer,
  inputExtension: string,
  fn: (workspace: TempWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await createTempWorkspace(input, inputExtension);
  try {
    return await fn(workspace);
  } finally {
    await workspace.cleanup();
  }
}
