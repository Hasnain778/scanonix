/**
 * GSC OAuth callback contract — redirect URI must match local listener.
 * Run: npm run verify:seo-gsc-auth
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  clientSecretExists,
  resolveGscCredentialPaths,
} from "@/lib/seo/local/credentials";
import {
  getAuthUrl,
  resolveOAuthRedirectTarget,
  resolveOAuthRedirectUri,
} from "@/lib/seo/local/auth";
import { GSC_READONLY_SCOPE } from "@/lib/seo/local/constants";

const root = process.cwd();

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

console.log("\nGSC OAuth callback verification\n");

const authScript = readSource("scripts/seo/auth.ts");
const libAuth = readSource("lib/seo/local/auth.ts");

assert("auth.ts uses resolveOAuthRedirectTarget", authScript.includes("resolveOAuthRedirectTarget"));
assert("auth.ts does not hardcode 42813 listener", !authScript.includes("42813"));
assert("auth.ts does not hardcode /oauth2callback path", !authScript.includes("/oauth2callback"));
assert("lib auth exports resolveOAuthRedirectTarget", libAuth.includes("export function resolveOAuthRedirectTarget"));
assert("readonly scope constant unchanged", GSC_READONLY_SCOPE.includes("webmasters.readonly"));
assert("lib auth rejects write scope at runtime", libAuth.includes("hasWrite"));

if (clientSecretExists()) {
  const redirectUri = resolveOAuthRedirectUri();
  const target = resolveOAuthRedirectTarget();
  const authUrl = getAuthUrl();

  assert("redirect URI resolves from client secret", redirectUri.length > 0);
  assert(
    "redirect target matches redirect URI host/path",
    target.redirectUri === redirectUri,
  );
  assert(
    "auth URL encodes the same redirect_uri",
    authUrl.includes(`redirect_uri=${encodeURIComponent(redirectUri)}`),
  );
  assert(
    "auth URL requests readonly scope only",
    authUrl.includes(encodeURIComponent(GSC_READONLY_SCOPE)),
  );
  const authUrlParams = new URL(authUrl).searchParams;
  const scopes = authUrlParams.get("scope")?.split(/\s+/).filter(Boolean) ?? [];
  assert(
    "auth URL does not request write scope",
    !scopes.includes("https://www.googleapis.com/auth/webmasters"),
  );

  console.log(`\nConfigured redirect URI: ${redirectUri}`);
  console.log(
    `Listener target: ${target.hostname}:${target.port}${target.pathname}`,
  );
} else {
  console.log("\n(client_secret.json not present — skipping live redirect URI checks)\n");
}

const { clientSecretPath, tokenPath } = resolveGscCredentialPaths();
const gitignore = readSource(".gitignore");
assert("client secret path gitignored", gitignore.includes(".secrets/"));
assert("token path under secrets dir", tokenPath.includes(".secrets"));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
