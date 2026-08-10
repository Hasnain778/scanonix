-- Scanonix billing fields, webhook idempotency, and profile billing protection
-- Safe to re-run.

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists subscription_price_id text,
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists profiles_stripe_subscription_id_key
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists profiles_subscription_status_idx
  on public.profiles (subscription_status);

create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default timezone('utc', now())
);

alter table public.stripe_webhook_events enable row level security;

-- Only service role should access webhook events (no user policies).

create or replace function public.protect_profile_billing_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.jwt()->>'role', '') = 'service_role' then
    return new;
  end if;

  if auth.uid() = old.id then
    if new.plan is distinct from old.plan
      or new.stripe_customer_id is distinct from old.stripe_customer_id
      or new.stripe_subscription_id is distinct from old.stripe_subscription_id
      or new.subscription_status is distinct from old.subscription_status
      or new.subscription_price_id is distinct from old.subscription_price_id
      or new.subscription_current_period_end is distinct from old.subscription_current_period_end
      or new.cancel_at_period_end is distinct from old.cancel_at_period_end
    then
      raise exception 'Billing fields cannot be updated directly';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_billing_fields on public.profiles;
create trigger protect_profile_billing_fields
  before update on public.profiles
  for each row
  execute function public.protect_profile_billing_fields();
