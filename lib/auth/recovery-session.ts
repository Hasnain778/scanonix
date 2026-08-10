export const RECOVERY_SESSION_FLAG = "scanonix-recovery-active";

export function markRecoverySessionActive(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(RECOVERY_SESSION_FLAG, "1");
}

export function clearRecoverySessionFlag(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(RECOVERY_SESSION_FLAG);
}

export function isRecoverySessionFlagActive(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.sessionStorage.getItem(RECOVERY_SESSION_FLAG) === "1";
}
