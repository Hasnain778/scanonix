export type QrScannerMode = "camera" | "upload";

export type QrScannerState =
  | "idle"
  | "initialising"
  | "scanning"
  | "detected"
  | "no-qr-found"
  | "permission-denied"
  | "camera-unavailable";

export type QrResultType = "url" | "email" | "phone" | "wifi" | "text";

export interface WifiDetails {
  ssid: string;
  password: string;
  security: string;
}

export interface ParsedQrResult {
  type: QrResultType;
  raw: string;
  displayValue: string;
  url?: string;
  email?: string;
  phone?: string;
  wifi?: WifiDetails;
}

export function getQrScannerStateMessage(state: QrScannerState): string {
  switch (state) {
    case "idle":
      return "Ready to scan";
    case "initialising":
      return "Initialising camera…";
    case "scanning":
      return "Scanning for QR code…";
    case "detected":
      return "QR code detected";
    case "no-qr-found":
      return "No QR code found in this image";
    case "permission-denied":
      return "Camera permission denied. Allow camera access in your browser settings and try again.";
    case "camera-unavailable":
      return "Camera unavailable on this device or browser.";
  }
}

export function getQrResultTypeLabel(type: QrResultType): string {
  switch (type) {
    case "url":
      return "Website URL";
    case "email":
      return "Email address";
    case "phone":
      return "Phone number";
    case "wifi":
      return "Wi-Fi network";
    case "text":
      return "Plain text";
  }
}
