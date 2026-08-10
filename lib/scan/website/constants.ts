export const SCAN_LIMITS = {
  /** Total scan timeout budget (ms) */
  totalTimeoutMs: 20_000,
  /** Per-request fetch timeout (ms) */
  fetchTimeoutMs: 12_000,
  /** TLS handshake timeout (ms) */
  tlsTimeoutMs: 8_000,
  /** Max redirect hops */
  maxRedirects: 10,
  /** Max response body bytes to read for HTML analysis */
  maxBodyBytes: 512 * 1024,
  /** Max header value length to store */
  maxHeaderLength: 4096,
} as const;

export const USER_AGENT = "Scanonix-Website-Intelligence/1.0 (+https://scanonix.com)";
