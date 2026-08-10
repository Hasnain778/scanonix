/**
 * Verify rembg outbound auth header construction (Phase 7I).
 * Run: npx tsx scripts/verify-rembg-service-auth.ts
 */

import assert from "node:assert/strict";
import { buildRembgServiceAuthHeaders } from "../lib/providers/background-removal/rembg-service-auth";

function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

let passed = 0;

function test(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test("no env → no Authorization header", () => {
  withEnv({ REMBG_SERVICE_SECRET: undefined, REMBG_WORKER_SECRET: undefined }, () => {
    assert.deepEqual(buildRembgServiceAuthHeaders(), {});
  });
});

test("REMBG_SERVICE_SECRET → Bearer header", () => {
  withEnv(
    { REMBG_SERVICE_SECRET: "server-secret-abc", REMBG_WORKER_SECRET: undefined },
    () => {
      assert.deepEqual(buildRembgServiceAuthHeaders(), {
        Authorization: "Bearer server-secret-abc",
      });
    },
  );
});

test("strips accidental Bearer prefix from env value", () => {
  withEnv({ REMBG_SERVICE_SECRET: "Bearer token-with-prefix", REMBG_WORKER_SECRET: undefined }, () => {
    assert.deepEqual(buildRembgServiceAuthHeaders(), {
      Authorization: "Bearer token-with-prefix",
    });
  });
});

test("REMBG_WORKER_SECRET fallback on server (alias only)", () => {
  withEnv({ REMBG_SERVICE_SECRET: undefined, REMBG_WORKER_SECRET: "worker-alias-secret" }, () => {
    assert.deepEqual(buildRembgServiceAuthHeaders(), {
      Authorization: "Bearer worker-alias-secret",
    });
  });
});

test("REMBG_SERVICE_SECRET preferred over REMBG_WORKER_SECRET", () => {
  withEnv(
    { REMBG_SERVICE_SECRET: "primary", REMBG_WORKER_SECRET: "secondary" },
    () => {
      assert.deepEqual(buildRembgServiceAuthHeaders(), {
        Authorization: "Bearer primary",
      });
    },
  );
});

console.log(`\n${passed}/${passed} rembg service auth checks passed.`);
