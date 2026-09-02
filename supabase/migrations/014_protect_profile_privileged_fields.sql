-- Protect profiles.role and profiles.status from self-service modification.
-- Extends protect_profile_billing_fields to cover INSERT + UPDATE privileged fields.
-- Safe to re-run.

create or replace function public.protect_profile_billing_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.jwt()->>'role', '') = 'service_role' then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    if coalesce(new.role, 'user') is distinct from 'user'
      or coalesce(new.status, 'active') is distinct from 'active'
    then
      raise exception 'Privileged profile fields cannot be set directly';
    end if;

    return new;
  end if;

  if TG_OP = 'UPDATE' and auth.uid() = old.id then
    if new.plan is distinct from old.plan
      or new.stripe_customer_id is distinct from old.stripe_customer_id
      or new.stripe_subscription_id is distinct from old.stripe_subscription_id
      or new.subscription_status is distinct from old.subscription_status
      or new.subscription_price_id is distinct from old.subscription_price_id
      or new.subscription_current_period_end is distinct from old.subscription_current_period_end
      or new.cancel_at_period_end is distinct from old.cancel_at_period_end
      or new.role is distinct from old.role
      or new.status is distinct from old.status
    then
      raise exception 'Protected profile fields cannot be updated directly';
    end if;
  end if;

  return new;
end;
$$;

-- Single trigger for INSERT + UPDATE avoids duplicate UPDATE execution.
-- handle_new_user (SECURITY DEFINER) inserts only id/full_name/avatar_url;
-- role/status resolve to defaults (user/active) before this trigger runs.
drop trigger if exists protect_profile_billing_fields on public.profiles;
create trigger protect_profile_billing_fields
  before insert or update on public.profiles
  for each row
  execute function public.protect_profile_billing_fields();
