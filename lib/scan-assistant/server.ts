import { createClient } from "@/lib/supabase/server";
import { requireScanHistoryUser } from "@/lib/scan-history/server";
import type { ScanAssistantMessage } from "@/lib/ai/scan-assistant/types";

interface MessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  source: "ai" | "deterministic" | null;
  created_at: string;
}

function mapMessage(row: MessageRow): ScanAssistantMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    ...(row.source ? { source: row.source } : {}),
    createdAt: row.created_at,
  };
}

export async function listScanAssistantMessages(scanId: string) {
  const user = await requireScanHistoryUser();
  if (!user) {
    return { error: "unauthorized" as const };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scan_assistant_messages")
    .select("id, role, content, source, created_at")
    .eq("scan_id", scanId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return { error: "query_failed" as const, message: error.message };
  }

  return {
    messages: (data as MessageRow[]).map(mapMessage),
    userId: user.id,
  };
}

export async function appendScanAssistantMessage(input: {
  scanId: string;
  role: "user" | "assistant";
  content: string;
  source?: "ai" | "deterministic";
  tokensUsed?: number | null;
}) {
  const user = await requireScanHistoryUser();
  if (!user) {
    return { error: "unauthorized" as const };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scan_assistant_messages")
    .insert({
      scan_id: input.scanId,
      user_id: user.id,
      role: input.role,
      content: input.content,
      source: input.source ?? null,
      tokens_used: input.tokensUsed ?? null,
    })
    .select("id, role, content, source, created_at")
    .single();

  if (error) {
    return { error: "insert_failed" as const, message: error.message };
  }

  return { message: mapMessage(data as MessageRow) };
}

export async function deleteLastAssistantMessage(scanId: string) {
  const user = await requireScanHistoryUser();
  if (!user) {
    return { error: "unauthorized" as const };
  }

  const supabase = await createClient();
  const { data: lastAssistant, error: fetchError } = await supabase
    .from("scan_assistant_messages")
    .select("id")
    .eq("scan_id", scanId)
    .eq("user_id", user.id)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    return { error: "query_failed" as const, message: fetchError.message };
  }

  if (!lastAssistant) {
    return { error: "not_found" as const };
  }

  const { error: deleteError } = await supabase
    .from("scan_assistant_messages")
    .delete()
    .eq("id", lastAssistant.id)
    .eq("user_id", user.id);

  if (deleteError) {
    return { error: "delete_failed" as const, message: deleteError.message };
  }

  return { ok: true as const };
}

export async function getLastUserMessage(scanId: string) {
  const user = await requireScanHistoryUser();
  if (!user) {
    return { error: "unauthorized" as const };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scan_assistant_messages")
    .select("id, role, content, source, created_at")
    .eq("scan_id", scanId)
    .eq("user_id", user.id)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { error: "query_failed" as const, message: error.message };
  }

  if (!data) {
    return { error: "not_found" as const };
  }

  return { message: mapMessage(data as MessageRow) };
}
