/**
 * OAuth authorization for local Search Console read-only access.
 * Run: npm run seo:auth
 *
 * NEVER commit client_secret.json or token.json.
 */

import { createServer } from "node:http";
import { URL } from "node:url";
import {
  clientSecretExists,
  buildHumanSetupRequired,
} from "@/lib/seo/local/credentials";
import {
  exchangeCodeForToken,
  getAuthUrl,
  resolveOAuthRedirectTarget,
} from "@/lib/seo/local/auth";
import { GSC_READONLY_SCOPE } from "@/lib/seo/local/constants";

async function main() {
  console.log("\nScanonix GSC OAuth (read-only)\n");
  console.log(`Scope: ${GSC_READONLY_SCOPE}`);
  console.log("Write scope: NOT requested\n");

  if (!clientSecretExists()) {
    const setup = buildHumanSetupRequired("OAuth client secret JSON not found.");
    console.log(`HUMAN_SETUP_REQUIRED: ${setup.reason}\n`);
    setup.steps.forEach((step, i) => console.log(`${i + 1}. ${step}`));
    process.exit(1);
  }

  const redirectTarget = resolveOAuthRedirectTarget();
  const authUrl = getAuthUrl();

  await new Promise<void>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const requestUrl = new URL(req.url ?? "/", redirectTarget.redirectUri);
        if (requestUrl.pathname !== redirectTarget.pathname) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const code = requestUrl.searchParams.get("code");
        const error = requestUrl.searchParams.get("error");

        if (error) {
          res.writeHead(400);
          res.end(`Authorization error: ${error}`);
          reject(new Error(error));
          server.close();
          return;
        }

        if (!code) {
          res.writeHead(400);
          res.end("Missing authorization code.");
          reject(new Error("Missing code"));
          server.close();
          return;
        }

        await exchangeCodeForToken(code);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Authorization complete</h1><p>You can close this window and run npm run seo:report</p></body></html>",
        );
        console.log("\n✓ Token saved locally (gitignored). Run: npm run seo:report\n");
        server.close();
        resolve();
      } catch (err) {
        reject(err);
        server.close();
      }
    });

    server.listen(redirectTarget.port, redirectTarget.hostname, () => {
      console.log(`OAuth redirect URI: ${redirectTarget.redirectUri}`);
      console.log("\n1. Open this URL in your browser:\n");
      console.log(authUrl);
      console.log("\n2. Sign in with the Google account that has Scanonix Search Console access.");
      console.log("3. Approve READ-ONLY access only.");
      console.log(
        `\nWaiting for callback on ${redirectTarget.redirectUri} ...\n`,
      );
    });

    server.on("error", (error) => {
      if (
        redirectTarget.port === 80 &&
        error instanceof Error &&
        (error.message.includes("EACCES") || error.message.includes("EADDRINUSE"))
      ) {
        reject(
          new Error(
            `Cannot bind to ${redirectTarget.redirectUri} (${error.message}). ` +
              "Port 80 may require elevated permissions or be in use. " +
              "Close other services on port 80 or run the terminal as Administrator, then retry.",
          ),
        );
        return;
      }

      reject(error);
    });
  });
}

main().catch((error) => {
  console.error("\nAuthorization failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
