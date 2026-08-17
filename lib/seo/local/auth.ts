import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { google } from "googleapis";
import {
  GSC_READONLY_SCOPES,
} from "@/lib/seo/local/constants";
import {
  clientSecretExists,
  resolveGscCredentialPaths,
} from "@/lib/seo/local/credentials";

type OAuthClientConfig = {
  client_id: string;
  client_secret: string;
  redirect_uris?: string[];
};

type OAuthClientSecretFile = {
  installed?: OAuthClientConfig;
  web?: OAuthClientConfig;
};

/** Loopback target derived from the Desktop OAuth client redirect URI. */
export interface OAuthRedirectTarget {
  redirectUri: string;
  hostname: string;
  port: number;
  pathname: string;
}

function readOAuthClientConfig(cwd = process.cwd()): OAuthClientConfig {
  const { clientSecretPath } = resolveGscCredentialPaths(cwd);
  const raw = readFileSync(clientSecretPath, "utf8");
  const config = JSON.parse(raw) as OAuthClientSecretFile;

  const credentials = config.installed ?? config.web;
  if (!credentials?.client_id || !credentials.client_secret) {
    throw new Error("Invalid OAuth client JSON — expected installed or web credentials.");
  }

  return credentials;
}

export function resolveOAuthRedirectUri(cwd = process.cwd()): string {
  const credentials = readOAuthClientConfig(cwd);
  return credentials.redirect_uris?.[0] ?? "http://127.0.0.1:42813/oauth2callback";
}

export function resolveOAuthRedirectTarget(cwd = process.cwd()): OAuthRedirectTarget {
  const redirectUri = resolveOAuthRedirectUri(cwd);
  const parsed = new URL(redirectUri);

  return {
    redirectUri,
    hostname: parsed.hostname,
    port: parsed.port
      ? Number(parsed.port)
      : parsed.protocol === "https:"
        ? 443
        : 80,
    pathname: parsed.pathname || "/",
  };
}

export function loadOAuthClient(cwd = process.cwd()) {
  const credentials = readOAuthClientConfig(cwd);
  const redirectUri = resolveOAuthRedirectUri(cwd);

  return new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    redirectUri,
  );
}

export function loadSavedToken(cwd = process.cwd()) {
  const { tokenPath } = resolveGscCredentialPaths(cwd);
  const raw = readFileSync(tokenPath, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

export function saveToken(token: Record<string, unknown>, cwd = process.cwd()) {
  const { tokenPath } = resolveGscCredentialPaths(cwd);
  mkdirSync(dirname(tokenPath), { recursive: true });
  writeFileSync(tokenPath, JSON.stringify(token, null, 2), "utf8");
}

export async function getAuthorizedSearchConsole(cwd = process.cwd()) {
  if (!clientSecretExists(cwd)) {
    throw new Error("GSC OAuth client secret not found.");
  }

  const oauth2Client = loadOAuthClient(cwd);
  const { tokenPath } = resolveGscCredentialPaths(cwd);

  try {
    oauth2Client.setCredentials(loadSavedToken(cwd));
  } catch {
    throw new Error("GSC OAuth token not found — run npm run seo:auth first.");
  }

  const tokenInfo = oauth2Client.credentials;
  const scopes = String(tokenInfo.scope ?? "").split(/\s+/).filter(Boolean);
  const hasReadonly = scopes.some((s) => s.includes("webmasters.readonly"));
  const hasWrite = scopes.some(
    (s) => s.includes("webmasters") && !s.includes("readonly"),
  );

  if (hasWrite) {
    throw new Error(
      "Token has write scope — revoke and re-authorize with webmasters.readonly only.",
    );
  }

  if (scopes.length > 0 && !hasReadonly) {
    throw new Error(
      "Token missing webmasters.readonly scope — run npm run seo:auth and approve read-only access.",
    );
  }

  oauth2Client.on("tokens", (tokens) => {
    const merged = { ...loadSavedToken(cwd), ...tokens };
    saveToken(merged, cwd);
  });

  return {
    auth: oauth2Client,
    searchconsole: google.searchconsole({ version: "v1", auth: oauth2Client }),
    tokenPath,
  };
}

export function getAuthUrl(cwd = process.cwd()): string {
  const oauth2Client = loadOAuthClient(cwd);
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [...GSC_READONLY_SCOPES],
    prompt: "consent",
  });
}

export async function exchangeCodeForToken(code: string, cwd = process.cwd()) {
  const oauth2Client = loadOAuthClient(cwd);
  const { tokens } = await oauth2Client.getToken(code.trim());
  saveToken(tokens as Record<string, unknown>, cwd);
  return tokens;
}
