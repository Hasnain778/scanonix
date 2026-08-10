/**
 * Processing history service stub — prepared for dashboard feature.
 */

export interface HistoryEntry {
  id: string;
  toolId: string;
  toolName: string;
  inputFilename: string;
  outputFilename: string | null;
  status: "success" | "error";
  createdAt: string;
}

export async function getHistory(): Promise<HistoryEntry[]> {
  return [];
}

export async function addHistoryEntry(
  entry: Omit<HistoryEntry, "id" | "createdAt">,
): Promise<HistoryEntry> {
  void entry;
  throw new Error("History is not yet enabled.");
}

export async function clearHistory(): Promise<void> {
  // no-op until backend is wired
}
