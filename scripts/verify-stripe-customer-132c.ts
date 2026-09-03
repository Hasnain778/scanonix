/**
 * Phase 132C-2 — stale Stripe customer recovery.
 * NO real Stripe or Supabase calls. Run: npm run verify:stripe-customer-132c
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getOrCreateStripeCustomer,
  isMissingStripeCustomerError,
  type ProfileCustomerStore,
  type StripeCustomerOps,
} from "../lib/stripe/customer";
import type { Profile } from "../types/auth";

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

function missingCustomerError(
  param: "customer" | "id",
  message = "No such customer: [redacted]; a similar object exists in test mode, but a live mode key was used to make this request.",
) {
  return {
    type: "StripeInvalidRequestError",
    rawType: "invalid_request_error",
    code: "resource_missing",
    param,
    message,
    raw: {
      type: "invalid_request_error",
      code: "resource_missing",
      param,
      message,
    },
  };
}

function profileWith(id: string | null): Profile {
  return { stripe_customer_id: id } as Profile;
}

function createStore(initial: string | null): ProfileCustomerStore & {
  value: string | null;
  persistCalls: Array<{ newCustomerId: string; expectedCurrentId: string | null }>;
  forcePersist?: ProfileCustomerStore["persist"];
} {
  const store = {
    value: initial,
    persistCalls: [] as Array<{ newCustomerId: string; expectedCurrentId: string | null }>,
    forcePersist: undefined as ProfileCustomerStore["persist"] | undefined,
    persist: async (input: {
      userId: string;
      newCustomerId: string;
      expectedCurrentId: string | null;
    }) => {
      store.persistCalls.push({
        newCustomerId: input.newCustomerId,
        expectedCurrentId: input.expectedCurrentId,
      });
      if (store.forcePersist) {
        return store.forcePersist(input);
      }
      if (store.value !== input.expectedCurrentId) {
        return { wrote: false, storedId: store.value, error: null };
      }
      store.value = input.newCustomerId;
      return { wrote: true, storedId: store.value, error: null };
    },
    read: async () => store.value,
  };
  return store;
}

async function main() {
  assert(
    "missing customer: param customer",
    isMissingStripeCustomerError(missingCustomerError("customer")),
  );
  assert(
    "missing customer: retrieve param id + No such customer",
    isMissingStripeCustomerError(missingCustomerError("id")),
  );
  assert(
    "F price resource_missing does not match",
    !isMissingStripeCustomerError({
      rawType: "invalid_request_error",
      code: "resource_missing",
      param: "line_items[0].price",
      message: "No such price: [redacted]",
      raw: {
        type: "invalid_request_error",
        code: "resource_missing",
        param: "line_items[0].price",
        message: "No such price: [redacted]",
      },
    }),
  );
  assert(
    "F product resource_missing does not match",
    !isMissingStripeCustomerError({
      rawType: "invalid_request_error",
      code: "resource_missing",
      param: "id",
      message: "No such product: [redacted]",
    }),
  );
  assert(
    "G authentication error does not match",
    !isMissingStripeCustomerError({
      type: "StripeAuthenticationError",
      rawType: "authentication_error",
      code: "api_key_expired",
      message: "Invalid API Key provided",
    }),
  );
  assert(
    "H rate-limit error does not match",
    !isMissingStripeCustomerError({
      type: "StripeRateLimitError",
      rawType: "rate_limit_error",
      code: "rate_limit",
      message: "Too many requests",
    }),
  );
  assert(
    "H network error does not match",
    !isMissingStripeCustomerError(new Error("network timeout")),
  );
  assert(
    "I malformed Stripe error does not match",
    !isMissingStripeCustomerError({ code: "resource_missing" }),
  );

  // A: no stored customer → create and save
  {
    const store = createStore(null);
    let created = 0;
    const stripe: StripeCustomerOps = {
      retrieve: async () => {
        throw new Error("retrieve must not run when no stored id");
      },
      create: async ({ email, userId }) => {
        created += 1;
        assert("A create uses trusted email", email === "owner@example.com");
        assert("A create uses trusted user id metadata path", userId === "user-1");
        return { id: "cus_new_empty" };
      },
    };
    const id = await getOrCreateStripeCustomer("user-1", "owner@example.com", profileWith(null), {
      stripe,
      store,
    });
    assert("A no stored customer → creates and saves", id === "cus_new_empty" && store.value === "cus_new_empty" && created === 1);
    assert("A persist expected null", store.persistCalls[0]?.expectedCurrentId === null);
  }

  // B: valid stored customer → reuse
  {
    const store = createStore("cus_valid");
    let created = 0;
    const stripe: StripeCustomerOps = {
      retrieve: async (id) => ({ id }),
      create: async () => {
        created += 1;
        return { id: "cus_should_not_create" };
      },
    };
    const id = await getOrCreateStripeCustomer("user-1", "owner@example.com", profileWith("cus_valid"), {
      stripe,
      store,
    });
    assert("B valid stored customer → reuses", id === "cus_valid" && created === 0 && store.persistCalls.length === 0);
  }

  // C/D/E: stale resource_missing → replacement created, saved, returned
  {
    const store = createStore("cus_stale");
    const stripe: StripeCustomerOps = {
      retrieve: async () => {
        throw missingCustomerError("id");
      },
      create: async () => ({ id: "cus_replacement" }),
    };
    const id = await getOrCreateStripeCustomer("user-1", "owner@example.com", profileWith("cus_stale"), {
      stripe,
      store,
    });
    assert("C stored customer resource_missing → creates replacement", id === "cus_replacement");
    assert("D replacement ID saved to profile", store.value === "cus_replacement");
    assert("E checkout receives replacement customer ID", id === "cus_replacement");
    assert("C persist CAS against stale id", store.persistCalls[0]?.expectedCurrentId === "cus_stale");
  }

  // checkout param:customer also recovers
  {
    const store = createStore("cus_stale");
    const stripe: StripeCustomerOps = {
      retrieve: async () => {
        throw missingCustomerError("customer");
      },
      create: async () => ({ id: "cus_from_checkout_shape" }),
    };
    const id = await getOrCreateStripeCustomer("user-1", "owner@example.com", profileWith("cus_stale"), {
      stripe,
      store,
    });
    assert("C checkout-shaped resource_missing recovers", id === "cus_from_checkout_shape");
  }

  // F: price missing thrown from retrieve must NOT replace
  {
    const store = createStore("cus_stale");
    let created = 0;
    const stripe: StripeCustomerOps = {
      retrieve: async () => {
        throw {
          rawType: "invalid_request_error",
          code: "resource_missing",
          param: "price",
          message: "No such price: [redacted]",
        };
      },
      create: async () => {
        created += 1;
        return { id: "cus_wrong" };
      },
    };
    let threw = false;
    try {
      await getOrCreateStripeCustomer("user-1", "owner@example.com", profileWith("cus_stale"), {
        stripe,
        store,
      });
    } catch {
      threw = true;
    }
    assert("F price resource_missing does not replace", threw && created === 0 && store.value === "cus_stale");
  }

  // G auth error
  {
    const store = createStore("cus_stale");
    let created = 0;
    const stripe: StripeCustomerOps = {
      retrieve: async () => {
        throw {
          type: "StripeAuthenticationError",
          rawType: "authentication_error",
          code: "api_key_expired",
        };
      },
      create: async () => {
        created += 1;
        return { id: "cus_wrong" };
      },
    };
    let threw = false;
    try {
      await getOrCreateStripeCustomer("user-1", "owner@example.com", profileWith("cus_stale"), {
        stripe,
        store,
      });
    } catch {
      threw = true;
    }
    assert("G authentication error does not replace", threw && created === 0 && store.value === "cus_stale");
  }

  // H rate-limit / network
  {
    const store = createStore("cus_stale");
    let created = 0;
    const stripe: StripeCustomerOps = {
      retrieve: async () => {
        throw { rawType: "rate_limit_error", code: "rate_limit" };
      },
      create: async () => {
        created += 1;
        return { id: "cus_wrong" };
      },
    };
    let threw = false;
    try {
      await getOrCreateStripeCustomer("user-1", "owner@example.com", profileWith("cus_stale"), {
        stripe,
        store,
      });
    } catch {
      threw = true;
    }
    assert("H rate-limit does not replace", threw && created === 0);

    created = 0;
    stripe.retrieve = async () => {
      throw new Error("ECONNRESET");
    };
    threw = false;
    try {
      await getOrCreateStripeCustomer("user-1", "owner@example.com", profileWith("cus_stale"), {
        stripe,
        store,
      });
    } catch {
      threw = true;
    }
    assert("H network failure does not replace", threw && created === 0 && store.value === "cus_stale");
  }

  // I malformed
  {
    const store = createStore("cus_stale");
    let created = 0;
    const stripe: StripeCustomerOps = {
      retrieve: async () => {
        throw { code: "resource_missing" };
      },
      create: async () => {
        created += 1;
        return { id: "cus_wrong" };
      },
    };
    let threw = false;
    try {
      await getOrCreateStripeCustomer("user-1", "owner@example.com", profileWith("cus_stale"), {
        stripe,
        store,
      });
    } catch {
      threw = true;
    }
    assert("I malformed error does not replace", threw && created === 0);
  }

  // J failed replacement creation does not overwrite profile
  {
    const store = createStore("cus_stale");
    const stripe: StripeCustomerOps = {
      retrieve: async () => {
        throw missingCustomerError("id");
      },
      create: async () => {
        throw new Error("create failed");
      },
    };
    let threw = false;
    try {
      await getOrCreateStripeCustomer("user-1", "owner@example.com", profileWith("cus_stale"), {
        stripe,
        store,
      });
    } catch {
      threw = true;
    }
    assert(
      "J failed replacement creation does not overwrite profile",
      threw && store.value === "cus_stale" && store.persistCalls.length === 0,
    );
  }

  // K failed profile persistence does not pretend success
  {
    const store = createStore("cus_stale");
    store.forcePersist = async () => ({
      wrote: false,
      storedId: "cus_stale",
      error: "write denied",
    });
    const stripe: StripeCustomerOps = {
      retrieve: async () => {
        throw missingCustomerError("id");
      },
      create: async () => ({ id: "cus_replacement" }),
    };
    let threw = false;
    let returned: string | null = null;
    try {
      returned = await getOrCreateStripeCustomer("user-1", "owner@example.com", profileWith("cus_stale"), {
        stripe,
        store,
      });
    } catch {
      threw = true;
    }
    assert("K failed persistence throws", threw && returned === null);
    assert("K profile still stale", store.value === "cus_stale");
  }

  // L concurrent stale recovery does not overwrite newer id
  {
    const store = createStore("cus_stale");
    store.forcePersist = async (input) => {
      store.persistCalls.push({
        newCustomerId: input.newCustomerId,
        expectedCurrentId: input.expectedCurrentId,
      });
      return { wrote: false, storedId: "cus_winner", error: null };
    };
    const retrieved: string[] = [];
    const stripe: StripeCustomerOps = {
      retrieve: async (id) => {
        retrieved.push(id);
        if (id === "cus_stale") {
          throw missingCustomerError("id");
        }
        return { id };
      },
      create: async () => ({ id: "cus_orphan_replacement" }),
    };
    const id = await getOrCreateStripeCustomer("user-1", "owner@example.com", profileWith("cus_stale"), {
      stripe,
      store,
    });
    assert("L reuses newer stored customer", id === "cus_winner");
    assert("L does not persist overwrite of winner", store.value === "cus_stale");
    assert(
      "L CAS expected stale id",
      store.persistCalls[0]?.expectedCurrentId === "cus_stale",
    );
  }

  const customerSource = readSource("lib/stripe/customer.ts");
  const checkoutSource = readSource("app/api/stripe/create-checkout-session/route.ts");
  const plansSource = readSource("lib/stripe/plans.ts");
  const notificationsSource = readSource("lib/monitors/notifications.ts");
  const emailSource = readSource("lib/notifications/email.ts");
  const verifierSource = readFileSync(join(root, "scripts/verify-stripe-customer-132c.ts"), "utf8");

  assert(
    "M plan mapping uses env price IDs",
    plansSource.includes("monthly: env.stripeProMonthlyPriceId") &&
      plansSource.includes("yearly: env.stripeProYearlyPriceId"),
  );
  assert(
    "N checkout still uses getOrCreateStripeCustomer",
    checkoutSource.includes("getOrCreateStripeCustomer("),
  );
  assert(
    "N checkout metadata keys unchanged",
    checkoutSource.includes("billing_interval: billingIntervalAnalytics") &&
      checkoutSource.includes("source_surface: sourceSurface") &&
      checkoutSource.includes('mode: "subscription"') &&
      checkoutSource.includes("line_items: [{ price: priceId, quantity: 1 }]"),
  );
  assert(
    "O 132B claim still pending WHERE",
    notificationsSource.includes('.eq("status", "pending")') &&
      notificationsSource.includes('.update({ status: "processing" })'),
  );
  assert(
    "O 132B email transport still Resend REST",
    emailSource.includes("https://api.resend.com/emails"),
  );
  const verifierHeader = verifierSource.slice(0, verifierSource.indexOf("async function main"));
  assert(
    "P verifier has no Stripe SDK import",
    !verifierHeader.includes('from "stripe"') && !verifierHeader.includes("from 'stripe'"),
  );
  assert(
    "P verifier uses mocked StripeCustomerOps only",
    verifierHeader.includes("StripeCustomerOps") && !verifierHeader.includes("getStripe("),
  );
  assert(
    "no test/live prefix mode detection",
    !customerSource.includes("cus_test") && !customerSource.includes("sk_test") && !customerSource.includes("sk_live"),
  );
  assert("service-role persist still uses createAdminClient", customerSource.includes("createAdminClient()"));
  assert(
    "create metadata still supabase_user_id only",
    customerSource.includes("supabase_user_id: input.userId") ||
      customerSource.includes("supabase_user_id: userId"),
  );

  console.log("");
  console.log(`132C-2 stale Stripe customer verify: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

void main();
