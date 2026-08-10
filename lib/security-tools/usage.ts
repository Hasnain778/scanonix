import { createAdminClient } from "@/lib/supabase/admin";
import type { SecurityToolId } from "@/lib/security-tools/constants";

export async function recordSecurityToolUsage(input: {
  userId: string;
  toolId: SecurityToolId;
  fileSizeBytes?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("security_tool_usage").insert({
      user_id: input.userId,
      tool_id: input.toolId,
      file_size_bytes: input.fileSizeBytes ?? null,
      metadata: input.metadata ?? null,
    });
  } catch {
    // Usage logging must not block tool operations.
  }
}
