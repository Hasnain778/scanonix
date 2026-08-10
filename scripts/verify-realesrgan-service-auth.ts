/**
 * Verify Real-ESRGAN outbound auth + service URL mapping (Phase 8C).
 * Run: npx tsx scripts/verify-realesrgan-service-auth.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildRealEsrganServiceAuthHeaders,
  isRealEsrganServiceAuthConfigured,
  readRealEsrganServiceUrl,
  resolveRealEsrganServiceRequest,
} from "../lib/providers/upscale/realesrgan-service-auth";

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
  withEnv(
    {
      REALESRGAN_SERVICE_SECRET: undefined,
      REALESRGAN_WORKER_SECRET: undefined,
      REALESRGAN_SERVICE_URL: undefined,
    },
    () => {
      assert.deepEqual(buildRealEsrganServiceAuthHeaders(), {});
      assert.equal(isRealEsrganServiceAuthConfigured(), false);
      assert.equal(readRealEsrganServiceUrl(), "");
    },
  );
});

test("REALESRGAN_SERVICE_URL resolves at call time", () => {
  withEnv(
    {
      REALESRGAN_SERVICE_URL: "https://upscale.scanonix.com",
      REALESRGAN_SERVICE_SECRET: "server-secret-abc",
    },
    () => {
      assert.equal(readRealEsrganServiceUrl(), "https://upscale.scanonix.com");
      const request = resolveRealEsrganServiceRequest();
      assert.equal(request.serviceUrl, "https://upscale.scanonix.com");
      assert.equal(request.headers.Authorization, "Bearer server-secret-abc");
    },
  );
});

test("REALESRGAN_SERVICE_SECRET → Bearer header", () => {
  withEnv(
    { REALESRGAN_SERVICE_SECRET: "server-secret-abc", REALESRGAN_WORKER_SECRET: undefined },
    () => {
      assert.deepEqual(buildRealEsrganServiceAuthHeaders(), {
        Authorization: "Bearer server-secret-abc",
      });
      assert.equal(isRealEsrganServiceAuthConfigured(), true);
    },
  );
});

test("strips accidental Bearer prefix from env value", () => {
  withEnv(
    { REALESRGAN_SERVICE_SECRET: "Bearer token-with-prefix", REALESRGAN_WORKER_SECRET: undefined },
    () => {
      assert.deepEqual(buildRealEsrganServiceAuthHeaders(), {
        Authorization: "Bearer token-with-prefix",
      });
    },
  );
});

test("REALESRGAN_WORKER_SECRET fallback on server (alias only)", () => {
  withEnv(
    { REALESRGAN_SERVICE_SECRET: undefined, REALESRGAN_WORKER_SECRET: "worker-alias-secret" },
    () => {
      assert.deepEqual(buildRealEsrganServiceAuthHeaders(), {
        Authorization: "Bearer worker-alias-secret",
      });
    },
  );
});

test("REALESRGAN_SERVICE_SECRET preferred over REALESRGAN_WORKER_SECRET", () => {
  withEnv(
    { REALESRGAN_SERVICE_SECRET: "primary", REALESRGAN_WORKER_SECRET: "secondary" },
    () => {
      assert.deepEqual(buildRealEsrganServiceAuthHeaders(), {
        Authorization: "Bearer primary",
      });
    },
  );
});

test("request-time env changes are reflected (no module-level cache)", () => {
  withEnv({ REALESRGAN_SERVICE_SECRET: "first", REALESRGAN_SERVICE_URL: "https://a.test" }, () => {
    assert.equal(buildRealEsrganServiceAuthHeaders().Authorization, "Bearer first");
    process.env.REALESRGAN_SERVICE_SECRET = "second";
    process.env.REALESRGAN_SERVICE_URL = "https://b.test";
    assert.equal(buildRealEsrganServiceAuthHeaders().Authorization, "Bearer second");
    assert.equal(readRealEsrganServiceUrl(), "https://b.test");
  });
});

test("provider uses runtime auth headers (not module-level env secret)", () => {
  const providerSource = readFileSync(
    join(process.cwd(), "lib/providers/upscale/realesrgan-provider.ts"),
    "utf8",
  );
  assert.match(providerSource, /buildRealEsrganServiceAuthHeaders\(\)/);
  assert.match(providerSource, /readRealEsrganServiceUrl\(\)/);
  assert.doesNotMatch(providerSource, /env\.realesrganServiceSecret/);
});

test("2x and 4x route through authenticated service provider path", () => {
  const routeSource = readFileSync(
    join(process.cwd(), "app/api/tools/image/upscale/route.ts"),
    "utf8",
  );
  const providerSource = readFileSync(
    join(process.cwd(), "lib/providers/upscale/realesrgan-provider.ts"),
    "utf8",
  );

  assert.match(routeSource, /realEsrganProvider\.upscale/);
  assert.match(routeSource, /factorRaw === 4 \? 4 : 2/);
  assert.match(providerSource, /callServiceUpscale/);
  assert.match(providerSource, /options\.factor/);
});

test("no Real-ESRGAN secrets exposed via public env module", () => {
  const publicEnvSource = readFileSync(join(process.cwd(), "config/env.public.ts"), "utf8");
  assert.doesNotMatch(publicEnvSource, /REALESRGAN_SERVICE_SECRET/);
  assert.doesNotMatch(publicEnvSource, /REALESRGAN_WORKER_SECRET/);

  const upscalerSource = readFileSync(
    join(process.cwd(), "components/tools/image-upscaler/ImageUpscalerTool.tsx"),
    "utf8",
  );
  assert.doesNotMatch(upscalerSource, /REALESRGAN_SERVICE_SECRET/);
  assert.doesNotMatch(upscalerSource, /Authorization/);
});

console.log(`\n${passed}/${passed} Real-ESRGAN service auth checks passed.`);
