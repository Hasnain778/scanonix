import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEMP_ROOT = join(tmpdir(), "scanonix-security-tools");

export interface TempFileHandle {
  path: string;
  cleanup: () => Promise<void>;
}

export async function createTempFile(
  prefix: string,
  extension: string,
  data: Buffer,
): Promise<TempFileHandle> {
  const sessionDir = join(TEMP_ROOT, randomUUID());
  await mkdir(sessionDir, { recursive: true });

  const safeExt = extension.replace(/[^a-z0-9.]/gi, "").slice(0, 10) || ".bin";
  const filePath = join(sessionDir, `${prefix}-${randomUUID()}${safeExt}`);
  await writeFile(filePath, data);

  return {
    path: filePath,
    cleanup: async () => {
      await rm(sessionDir, { recursive: true, force: true });
    },
  };
}

export async function withTempFile<T>(
  prefix: string,
  extension: string,
  data: Buffer,
  fn: (handle: TempFileHandle) => Promise<T>,
): Promise<T> {
  const handle = await createTempFile(prefix, extension, data);
  try {
    return await fn(handle);
  } finally {
    await handle.cleanup();
  }
}
