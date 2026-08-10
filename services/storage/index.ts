/**
 * Cloud storage service — backed by Supabase Storage.
 */
import {
  AVATARS_BUCKET,
  USER_FILES_BUCKET,
  deleteUserFile,
  getPublicUrl,
  listUserFiles,
  uploadUserFile,
} from "@/lib/supabase/storage";

export interface StoredFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

export {
  AVATARS_BUCKET,
  USER_FILES_BUCKET,
  getPublicUrl,
  uploadUserFile,
  deleteUserFile,
  listUserFiles,
};

export async function uploadFile(file: File, userId: string): Promise<StoredFile> {
  const { path, error } = await uploadUserFile(userId, file);
  if (error || !path) {
    throw new Error(error ?? "Upload failed");
  }

  return {
    id: path,
    name: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    url: getPublicUrl(USER_FILES_BUCKET, path),
    createdAt: new Date().toISOString(),
  };
}

export async function deleteFile(path: string): Promise<void> {
  const { error } = await deleteUserFile(USER_FILES_BUCKET, path);
  if (error) {
    throw new Error(error);
  }
}

export async function listFiles(userId: string): Promise<StoredFile[]> {
  const items = await listUserFiles(userId);
  return items.map((item) => ({
    id: `${userId}/${item.name}`,
    name: item.name,
    mimeType: "application/octet-stream",
    sizeBytes: 0,
    url: getPublicUrl(USER_FILES_BUCKET, `${userId}/${item.name}`),
    createdAt: item.created_at,
  }));
}
