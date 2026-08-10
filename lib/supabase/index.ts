export { createClient, resetBrowserClient } from "./client";
export { createClient as createServerClient, createAnonymousClient } from "./server";
export { updateSession } from "./middleware";
export { verifySupabaseConnection, type SupabaseHealthResult } from "./health";
export { getProfile, updateProfile, listProfiles } from "./database";
export {
  uploadUserFile,
  deleteUserFile,
  listUserFiles,
  getPublicUrl,
  AVATARS_BUCKET,
  USER_FILES_BUCKET,
} from "./storage";
