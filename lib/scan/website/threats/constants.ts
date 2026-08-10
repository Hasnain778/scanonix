/** Threat analysis limits — prevents oversized downloads and runaway analysis. */
export const THREAT_LIMITS = {
  /** Max inline script blocks to analyze */
  maxInlineScripts: 25,
  /** Max external script URLs to fetch */
  maxExternalScripts: 5,
  /** Max bytes per individual script */
  maxScriptBytes: 256 * 1024,
  /** Max total script bytes analyzed across all sources */
  maxTotalScriptBytes: 512 * 1024,
  /** Max iframe elements inspected */
  maxIframes: 30,
  /** Max forms inspected */
  maxForms: 20,
  /** Per external script fetch timeout */
  scriptFetchTimeoutMs: 6_000,
  /** Total threat analysis time budget */
  analysisBudgetMs: 10_000,
  /** Max evidence snippet length stored in findings */
  maxEvidenceLength: 280,
  /** Max matches per pattern category */
  maxMatchesPerCategory: 5,
} as const;

export type ThreatCategory =
  | "dangerous-api"
  | "obfuscation"
  | "iframe"
  | "redirect"
  | "form"
  | "crypto-miner"
  | "malicious-cdn"
  | "event-handler"
  | "base64-script"
  | "external-script";

/** Known malicious or high-risk CDN / host patterns (substring match, lowercase). */
export const SUSPICIOUS_CDN_PATTERNS: { pattern: string; label: string }[] = [
  { pattern: "coinhive.com", label: "CoinHive miner CDN" },
  { pattern: "coin-hive.com", label: "CoinHive variant" },
  { pattern: "cryptonight", label: "Cryptonight miner reference" },
  { pattern: "minero.cc", label: "Minero mining service" },
  { pattern: "crypto-loot.org", label: "Crypto-Loot miner" },
  { pattern: "jsecoin.com", label: "JSEcoin miner" },
  { pattern: "ppoi.org", label: "Known miner proxy domain" },
  { pattern: "authedmine.com", label: "AuthedMine miner" },
];

/** Crypto miner code indicators inside script content. */
export const CRYPTO_MINER_CODE_PATTERNS = [
  /coinhive\.com/i,
  /cryptonight/i,
  /CryptoNight/i,
  /webassembly.*miner/i,
  /WASM.*crypt/i,
  /deepMiner/i,
  /CoinImp/i,
  /crypto-loot/i,
  /authedmine/i,
] as const;
