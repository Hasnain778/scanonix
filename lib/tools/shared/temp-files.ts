import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEMP_ROOT = join(tmpdir(), "scanonix-tools");

export interface TempFileHandle {
  path: string;
  cleanup: () => Promise<void>;
}

export async function withTempFile<T>(
  prefix: string,
  extension: string,
  data: Buffer,
  fn: (handle: TempFileHandle) => Promise<T>,
): Promise<T> {
  const sessionDir = join(TEMP_ROOT, randomUUID());
  await mkdir(sessionDir, { recursive: true });

  const safeExt = extension.replace(/[^a-z0-9.]/gi, "").slice(0, 10) || ".bin";
  const filePath = join(sessionDir, `${prefix}-${randomUUID()}${safeExt}`);
  await writeFile(filePath, data);

  try {
    return await fn({ path: filePath, cleanup: async () => rm(sessionDir, { recursive: true, force: true }) });
  } finally {
    await rm(sessionDir, { recursive: true, force: true });
  }
}
