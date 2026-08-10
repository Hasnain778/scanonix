-- Usage tracking for plan enforcement (idempotent)

create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  usage_count integer not null default 0 check (usage_count >= 0),
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint usage_counters_user_action_period_key unique (user_id, action, period_start)
);

create index if not exists usage_counters_user_id_idx
  on public.usage_counters (user_id);

create index if not exists usage_counters_period_end_idx
  on public.usage_counters (period_end);

alter table public.usage_counters enable row level security;

drop policy if exists "Users can read own usage counters" on public.usage_counters;
create policy "Users can read own usage counters"
  on public.usage_counters
  for select
  to authenticated
  using (auth.uid() = user_id);

-- No insert/update/delete policies for authenticated users.
-- Counters are updated only via service role or security definer RPC.

create or replace function public.set_usage_counters_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists usage_counters_set_updated_at on public.usage_counters;
create trigger usage_counters_set_updated_at
  before update on public.usage_counters
  for each row
  execute function public.set_usage_counters_updated_at();

-- Atomically increment usage when under limit. Service role only.
create or replace function public.consume_tool_usage(
  p_user_id uuid,
  p_action text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_existing integer;
begin
  if p_limit <= 0 then
    return jsonb_build_object(
      'allowed', false,
      'usage_count', 0,
      'limit', p_limit,
      'remaining', 0
    );
  end if;

  insert into public.usage_counters (user_id, action, period_start, period_end, usage_count)
  values (p_user_id, p_action, p_period_start, p_period_end, 0)
  on conflict (user_id, action, period_start) do nothing;

  update public.usage_counters
  set usage_count = usage_count + 1
  where user_id = p_user_id
    and action = p_action
    and period_start = p_period_start
    and usage_count < p_limit
  returning usage_count into v_count;

  if v_count is not null then
    return jsonb_build_object(
      'allowed', true,
      'usage_count', v_count,
      'limit', p_limit,
      'remaining', greatest(p_limit - v_count, 0)
    );
  end if;

  select usage_count
  into v_existing
  from public.usage_counters
  where user_id = p_user_id
    and action = p_action
    and period_start = p_period_start;

  return jsonb_build_object(
    'allowed', false,
    'usage_count', coalesce(v_existing, 0),
    'limit', p_limit,
    'remaining', 0
  );
end;
$$;

revoke all on function public.consume_tool_usage(uuid, text, timestamptz, timestamptz, integer) from public;
grant execute on function public.consume_tool_usage(uuid, text, timestamptz, timestamptz, integer) to service_role;
