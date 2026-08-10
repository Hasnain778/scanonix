import { createAdminClient } from "@/lib/supabase/admin";
import { USER_FILES_BUCKET } from "@/lib/supabase/storage";
import { upscaleJobBasePath } from "./paths";

const RESULT_SIGNED_URL_TTL_SECONDS = 3600;

export async function uploadInput(
  storagePath: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.storage.from(USER_FILES_BUCKET).upload(storagePath, buffer, {
    upsert: false,
    contentType,
  });

  if (error) {
    throw new Error(`Could not upload upscale input: ${error.message}`);
  }
}

export async function getSignedResultUrl(storagePath: string): Promise<string> {
  const admin = createAdminClient();

  const { data, error } = await admin.storage
    .from(USER_FILES_BUCKET)
    .createSignedUrl(storagePath, RESULT_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not create signed result URL.");
  }

  return data.signedUrl;
}

export async function deleteJobFiles(userId: string, jobId: string): Promise<void> {
  const admin = createAdminClient();
  const prefix = upscaleJobBasePath(userId, jobId);

  const { data: listed, error: listError } = await admin.storage
    .from(USER_FILES_BUCKET)
    .list(prefix);

  if (listError) {
    throw new Error(`Could not list upscale job files: ${listError.message}`);
  }

  if (!listed?.length) {
    return;
  }

  const paths = listed.map((item) => `${prefix}/${item.name}`);
  const { error: removeError } = await admin.storage.from(USER_FILES_BUCKET).remove(paths);

  if (removeError) {
    throw new Error(`Could not delete upscale job files: ${removeError.message}`);
  }
}
