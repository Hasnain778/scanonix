export const SCAN_HISTORY_UPDATED_EVENT = "scanonix:scan-history-updated";

export interface ScanHistoryUpdatedDetail {
  scanId?: string;
}

export function notifyScanHistoryUpdated(detail?: ScanHistoryUpdatedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SCAN_HISTORY_UPDATED_EVENT, { detail }));
}
