import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_GSC_CLIENT_SECRET_FILENAME,
  DEFAULT_GSC_SECRETS_DIR,
  DEFAULT_GSC_TOKEN_FILENAME,
} from "@/lib/seo/local/constants";
import type { HumanSetupRequired } from "@/lib/seo/local/types";

export interface GscCredentialPaths {
  clientSecretPath: string;
  tokenPath: string;
}

export function resolveGscCredentialPaths(cwd = process.cwd()): GscCredentialPaths {
  const secretsDir =
    process.env.GSC_SECRETS_DIR?.trim() || join(cwd, DEFAULT_GSC_SECRETS_DIR);

  return {
    clientSecretPath:
      process.env.GSC_OAUTH_CLIENT_SECRET_PATH?.trim() ||
      join(secretsDir, DEFAULT_GSC_CLIENT_SECRET_FILENAME),
    tokenPath:
      process.env.GSC_OAUTH_TOKEN_PATH?.trim() ||
      join(secretsDir, DEFAULT_GSC_TOKEN_FILENAME),
  };
}

export function credentialsExist(cwd = process.cwd()): boolean {
  const { clientSecretPath, tokenPath } = resolveGscCredentialPaths(cwd);
  return existsSync(clientSecretPath) && existsSync(tokenPath);
}

export function clientSecretExists(cwd = process.cwd()): boolean {
  return existsSync(resolveGscCredentialPaths(cwd).clientSecretPath);
}

export function buildHumanSetupRequired(reason: string): HumanSetupRequired {
  const { clientSecretPath, tokenPath } = resolveGscCredentialPaths();
  const secretsDir = process.env.GSC_SECRETS_DIR?.trim() || DEFAULT_GSC_SECRETS_DIR;

  return {
    status: "HUMAN_SETUP_REQUIRED",
    reason,
    steps: [
      "Open Google Cloud Console and select or create a Scanonix project (do not reuse unrelated OAuth clients).",
      "Enable the Google Search Console API (Webmasters API) for that project.",
      "Configure the OAuth consent screen if prompted (External or Internal as appropriate).",
      "Create an OAuth Desktop client and download the client configuration JSON.",
      `Store the JSON outside git at: ${secretsDir}/${DEFAULT_GSC_CLIENT_SECRET_FILENAME} (or set GSC_OAUTH_CLIENT_SECRET_PATH).`,
      "Do NOT paste client secrets or tokens into Cursor chat or commit them to git.",
      "Run: npm run seo:auth — authorize with the Google account that already has Scanonix Search Console access.",
      "Approve ONLY the read-only scope: https://www.googleapis.com/auth/webmasters.readonly",
      `Token will be saved locally at: ${tokenPath} (gitignored).`,
      "Run: npm run seo:report — verify properties list and baseline metrics.",
      "Optional: npm run seo:index-audit — 36-tool URL inspection (rate-limited).",
    ],
  };
}

/** Sanitize GSC property URL for safe report output (no emails/secrets). */
export function sanitizePropertyUrl(siteUrl: string): string {
  try {
    const parsed = new URL(siteUrl);
    if (parsed.protocol === "sc-domain:") {
      return `sc-domain:${parsed.hostname.replace(/^sc-domain:/, "")}`;
    }
    return `${parsed.protocol}//${parsed.host}/`;
  } catch {
    return siteUrl.startsWith("sc-domain:") ? siteUrl : "[property]";
  }
}

/** Pick Scanonix property — env override, then list match (no blind sc-domain vs url-prefix guess). */
export function findScanonixProperty(siteUrls: string[]): string | undefined {
  const override = process.env.GSC_SITE_URL?.trim();
  if (override) {
    const match = siteUrls.find((url) => url === override);
    if (match) return match;
  }

  const normalized = siteUrls.map((url) => url.toLowerCase());

  const exactMatches = normalized.filter(
    (url) =>
      url === "sc-domain:scanonix.com" ||
      url === "https://www.scanonix.com/" ||
      url === "https://scanonix.com/",
  );

  if (exactMatches.length === 1) {
    return siteUrls[normalized.indexOf(exactMatches[0])];
  }

  const partial = siteUrls.filter((url) => /scanonix\.com/i.test(url));
  if (partial.length === 1) return partial[0];

  return undefined;
}
