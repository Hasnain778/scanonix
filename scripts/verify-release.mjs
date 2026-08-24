#!/usr/bin/env node
/**
 * Release verification orchestrator — FAST / FULL / EXTERNAL tiers.
 *
 * npm run verify:release:fast   — lint, typecheck, static verifications (no build)
 * npm run verify:release        — full pre-release gate (build once + E2E)
 * npm run verify:release:external — production smoke (optional, network)
 *
 * Env:
 *   SKIP_BUILD=1           — reuse existing .next
 *   SKIP_E2E=1             — skip browser tests
 *   REGRESSION_BASE_URL      — E2E target (default http://localhost:3000)
 *   START_LOCAL_SERVER=1     — spawn `npm run start` if base URL unreachable
 */

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const mode = process.argv[2] || "full";
const root = process.cwd();
const baseUrl = process.env.REGRESSION_BASE_URL || "http://localhost:3000";
let serverProc = null;

function runNode(label, script, env = {}) {
  console.log(`\n▶ ${label}`);
  try {
    execFileSync(process.execPath, [script], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
  } catch (error) {
    console.error(`\n✗ Release gate failed at: ${label}\n`);
    cleanup();
    process.exit(typeof error.status === "number" ? error.status : 1);
  }
}

function npmRun(script) {
  console.log(`\n▶ ${script}`);
  const result = spawnSync("npm", ["run", script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    console.error(`\n✗ Release gate failed at: ${script}\n`);
    cleanup();
    process.exit(result.status || 1);
  }
}

function runStep(label, cmd, args = []) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    console.error(`\n✗ Release gate failed at: ${label}\n`);
    cleanup();
    process.exit(result.status || 1);
  }
}

async function isReachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    if (await isReachable(url)) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function ensureServer() {
  if (await isReachable(baseUrl)) {
    console.log(`Using existing server at ${baseUrl}`);
    return;
  }
  if (process.env.START_LOCAL_SERVER !== "1") {
    console.error(`Server not reachable at ${baseUrl}. Set START_LOCAL_SERVER=1 or start next start.`);
    process.exit(1);
  }
  console.log(`Starting local server for ${baseUrl}...`);
  serverProc = spawn("npm", ["run", "start"], {
    cwd: root,
    stdio: "ignore",
    detached: true,
    shell: process.platform === "win32",
    env: { ...process.env, PORT: "3000" },
  });
  if (!(await waitForServer(baseUrl))) {
    console.error("Local server failed to become ready");
    cleanup();
    process.exit(1);
  }
}

function cleanup() {
  if (serverProc?.pid) {
    try {
      process.kill(-serverProc.pid);
    } catch {
      try {
        process.kill(serverProc.pid);
      } catch {
        /* ignore */
      }
    }
  }
}

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

async function runFast() {
  npmRun("lint");
  npmRun("typecheck");
  runStep("regression fixtures verify", process.execPath, [
    "scripts/regression/generate-fixtures.mjs",
    "--verify",
  ]);
  npmRun("verify:core-processing");
  npmRun("verify:bg-remover-quota");
  npmRun("verify:background-remover-model-config");
  npmRun("verify:analytics-130e-subscription-complete");
  npmRun("verify:seo-canonical-host");
}

async function runFull() {
  await runFast();

  if (process.env.SKIP_BUILD !== "1") {
    npmRun("build");
  } else if (!existsSync(".next/BUILD_ID")) {
    console.error("SKIP_BUILD=1 but .next/BUILD_ID missing");
    process.exit(1);
  }

  npmRun("verify:sharp-production");

  if (process.env.SKIP_E2E !== "1") {
    await ensureServer();
    runNode("server tools local", "scripts/regression/server-tools-local.mjs", {
      REGRESSION_BASE_URL: baseUrl,
    });
    runNode("client tools E2E", "scripts/regression/client-tools-e2e.mjs", {
      REGRESSION_BASE_URL: baseUrl,
    });
  }
}

async function runExternal() {
  runNode("production smoke", "scripts/smoke/production-smoke.mjs");
}

console.log(`\n=== Scanonix release verification (${mode}) ===`);

try {
  if (mode === "fast") {
    await runFast();
  } else if (mode === "external") {
    await runExternal();
  } else {
    await runFull();
  }
  console.log(`\n✓ verify:release (${mode}) passed.\n`);
} finally {
  cleanup();
}
