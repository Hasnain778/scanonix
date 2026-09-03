import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types/auth";

export type StripeCustomerOps = {
  retrieve: (id: string) => Promise<{ id: string }>;
  create: (input: { email: string; userId: string }) => Promise<{ id: string }>;
};

export type ProfileCustomerStore = {
  persist: (input: {
    userId: string;
    newCustomerId: string;
    expectedCurrentId: string | null;
  }) => Promise<{
    wrote: boolean;
    storedId: string | null;
    error: string | null;
  }>;
  read: (userId: string) => Promise<string | null>;
};

export interface GetOrCreateStripeCustomerDeps {
  stripe?: StripeCustomerOps;
  store?: ProfileCustomerStore;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stripeApiErrorType(error: object): string {
  const record = asRecord(error) ?? {};
  const raw = asRecord(record.raw);
  const candidates = [record.rawType, raw?.type, record.type].map(readString);
  if (candidates.includes("invalid_request_error")) {
    return "invalid_request_error";
  }
  return candidates.find(Boolean) ?? "";
}

function stripeApiErrorField(error: object, key: "code" | "param" | "message"): string {
  const record = asRecord(error) ?? {};
  const raw = asRecord(record.raw);
  return readString(raw?.[key]) || readString(record[key]);
}

/**
 * True only for a missing Stripe Customer in the current API mode.
 * Matches checkout `param: customer` and retrieve `param: id` + "No such customer".
 * Does not match price/product resource_missing, auth, rate-limit, or network errors.
 */
export function isMissingStripeCustomerError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const type = stripeApiErrorType(error).toLowerCase();
  const code = stripeApiErrorField(error, "code");
  const param = stripeApiErrorField(error, "param");
  const message = stripeApiErrorField(error, "message");

  if (type !== "invalid_request_error") {
    return false;
  }
  if (code !== "resource_missing") {
    return false;
  }
  if (param === "customer") {
    return true;
  }
  if (param === "id" && /^No such customer\b/i.test(message)) {
    return true;
  }
  return false;
}

function normalizeStoredCustomerId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

async function defaultRetrieve(id: string): Promise<{ id: string }> {
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(id);
  if ("deleted" in customer && customer.deleted) {
    throw new Error("Stored Stripe customer cannot be used.");
  }
  return { id: customer.id };
}

async function defaultCreate(input: { email: string; userId: string }): Promise<{ id: string }> {
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: input.email,
    metadata: {
      supabase_user_id: input.userId,
    },
  });
  return { id: customer.id };
}

function defaultStripeOps(): StripeCustomerOps {
  return {
    retrieve: defaultRetrieve,
    create: defaultCreate,
  };
}

function defaultStore(): ProfileCustomerStore {
  return {
    persist: async ({ userId, newCustomerId, expectedCurrentId }) => {
      const admin = createAdminClient();
      let query = admin
        .from("profiles")
        .update({ stripe_customer_id: newCustomerId })
        .eq("id", userId);

      query =
        expectedCurrentId === null
          ? query.is("stripe_customer_id", null)
          : query.eq("stripe_customer_id", expectedCurrentId);

      const { data, error } = await query.select("stripe_customer_id").maybeSingle();

      if (error) {
        return { wrote: false, storedId: null, error: error.message };
      }
      if (data?.stripe_customer_id) {
        return { wrote: true, storedId: data.stripe_customer_id, error: null };
      }

      const { data: current, error: readError } = await admin
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", userId)
        .maybeSingle();

      if (readError) {
        return { wrote: false, storedId: null, error: readError.message };
      }

      return {
        wrote: false,
        storedId: normalizeStoredCustomerId(current?.stripe_customer_id),
        error: null,
      };
    },
    read: async (userId) => {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        throw new Error(`Failed to store Stripe customer ID: ${error.message}`);
      }
      return normalizeStoredCustomerId(data?.stripe_customer_id);
    },
  };
}

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  profile: Profile | null,
  deps: GetOrCreateStripeCustomerDeps = {},
): Promise<string> {
  const stripe = deps.stripe ?? defaultStripeOps();
  const store = deps.store ?? defaultStore();
  const storedId = normalizeStoredCustomerId(profile?.stripe_customer_id);

  if (storedId) {
    try {
      const existing = await stripe.retrieve(storedId);
      if (existing.id) {
        return existing.id;
      }
    } catch (error) {
      if (!isMissingStripeCustomerError(error)) {
        throw error;
      }
    }
  }

  const created = await stripe.create({ email, userId });
  if (!created.id) {
    throw new Error("Stripe customer creation returned no id.");
  }

  const persist = await store.persist({
    userId,
    newCustomerId: created.id,
    expectedCurrentId: storedId,
  });

  if (persist.error) {
    throw new Error(`Failed to store Stripe customer ID: ${persist.error}`);
  }

  if (persist.wrote) {
    return persist.storedId ?? created.id;
  }

  const winnerId = persist.storedId ?? (await store.read(userId));
  if (winnerId && winnerId !== storedId) {
    const winner = await stripe.retrieve(winnerId);
    if (winner.id) {
      return winner.id;
    }
  }

  throw new Error("Failed to store Stripe customer ID: concurrent update.");
}

export async function findUserIdByStripeCustomerId(
  customerId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve user by Stripe customer: ${error.message}`);
  }

  return data?.id ?? null;
}
