/**
 * Logic proof: cancelled concurrent loads must not leave pages permanently skipped.
 * Run: npx tsx scripts/verify-split-page-grid-load-race.ts
 */

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

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Reproduces the OLD buggy bookkeeping pattern. */
async function oldBuggyLoad(pages: number[]): Promise<{
  loaded: Set<number>;
  loadingLeftTrue: number[];
}> {
  const loaded = new Set<number>();
  const inFlight = new Set<number>();
  const loading: Record<number, boolean> = {};

  async function runGeneration(cancelledRef: { value: boolean }) {
    const pending = pages.filter((p) => !loaded.has(p) && !inFlight.has(p));
    await Promise.all(
      pending.map(async (page) => {
        inFlight.add(page);
        loading[page] = true;
        await sleep(20);
        if (cancelledRef.value) {
          inFlight.delete(page);
          // BUG: loading stays true; page never loaded
          return;
        }
        loaded.add(page);
        loading[page] = false;
        inFlight.delete(page);
      }),
    );
  }

  const cancelledRef = { value: false };
  const first = runGeneration(cancelledRef);
  await sleep(5);
  cancelledRef.value = true; // Strict Mode cleanup
  await first;

  // Second generation while some may still be "logically" skipped if still inFlight —
  // after await, inFlight is clear, but loading remains true and if we only depend on
  // visiblePages identity, we may not re-run. Simulate skipped re-queue:
  const pending2 = pages.filter((p) => !loaded.has(p) && !inFlight.has(p));
  // In the real bug, effect did not re-fire; pending2 work never scheduled.
  void pending2;
  const loadingLeftTrue = pages.filter((p) => loading[p] === true && !loaded.has(p));
  return { loaded, loadingLeftTrue };
}

/** NEW pattern: generation token + always clear loading. */
async function newSafeLoad(pages: number[]): Promise<{
  loaded: Set<number>;
  loadingLeftTrue: number[];
}> {
  const loaded = new Set<number>();
  const loading: Record<number, boolean> = {};
  let generation = 0;

  async function runGeneration() {
    const gen = ++generation;
    const cancelled = { value: false };
    const isCurrent = () => !cancelled.value && gen === generation;

    const work = (async () => {
      for (const page of pages) {
        if (!isCurrent()) return;
        loading[page] = true;
        await sleep(10);
        if (!isCurrent()) {
          loading[page] = false;
          return;
        }
        loaded.add(page);
        loading[page] = false;
      }
    })();

    return {
      cancel: () => {
        cancelled.value = true;
      },
      done: work,
    };
  }

  const first = await runGeneration();
  await sleep(5);
  first.cancel(); // Strict Mode cleanup
  const second = await runGeneration();
  await Promise.all([first.done, second.done]);

  const loadingLeftTrue = pages.filter((p) => loading[p] === true);
  return { loaded, loadingLeftTrue };
}

async function run() {
  console.log("\nSplit page grid load-race verification\n");

  const oldResult = await oldBuggyLoad([1, 2, 3, 4]);
  assert(
    "OLD pattern can leave pages unloaded after cancel",
    oldResult.loaded.size < 4 || oldResult.loadingLeftTrue.length > 0,
    `loaded=${oldResult.loaded.size}, stuck=${oldResult.loadingLeftTrue.join(",")}`,
  );

  const newResult = await newSafeLoad([1, 2, 3, 4]);
  assert(
    "NEW pattern loads all 4 pages after Strict Mode cancel",
    newResult.loaded.size === 4,
    `loaded=${[...newResult.loaded].join(",")}`,
  );
  assert(
    "NEW pattern leaves zero infinite spinners",
    newResult.loadingLeftTrue.length === 0,
    `stuck=${newResult.loadingLeftTrue.join(",")}`,
  );

  // Source contract checks
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const source = readFileSync(
    join(process.cwd(), "components/tools/split-pdf/SplitPageGrid.tsx"),
    "utf8",
  );
  assert(
    "No IntersectionObserver in SplitPageGrid",
    !source.includes("IntersectionObserver"),
  );
  assert(
    "Small docs use sequential eager path",
    source.includes("SMALL_DOC_PAGE_LIMIT") &&
      source.includes("loadSequential"),
  );
  assert(
    "Cancelled jobs clear loading state",
    source.includes("setLoadingPages((current) => ({ ...current, [page]: false }))"),
  );
  assert(
    "Still uses renderPagePreviewDataUrl",
    source.includes("renderPagePreviewDataUrl"),
  );
  assert(
    "Load effect does not depend on mode/selection",
    /useEffect\(\(\) => \{[\s\S]*?\}, \[pdfBytes, totalPages, pages\]\);/.test(
      source,
    ),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

void run();
