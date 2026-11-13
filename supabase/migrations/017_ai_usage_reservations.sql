-- Idempotent reservations for premium AI calls against the shared tool_operation counter.
-- Does not modify consume_tool_usage. No automatic recovery of abandoned rows.

create table if not exists public.ai_usage_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'reserved' check (status in ('reserved', 'committed', 'released')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_usage_reservations_action_check check (action = 'tool_operation'),
  constraint ai_usage_reservations_period_check check (period_end > period_start)
);

alter table public.ai_usage_reservations enable row level security;

revoke all on table public.ai_usage_reservations from public;
revoke all on table public.ai_usage_reservations from anon;
revoke all on table public.ai_usage_reservations from authenticated;
grant select, insert, update on table public.ai_usage_reservations to service_role;

create or replace function public.reserve_tool_operation(
  p_user_id uuid,
  p_action text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
  v_existing integer;
  v_reservation_id uuid;
begin
  if p_user_id is null or p_action is distinct from 'tool_operation' then
    raise exception 'reservation action is not permitted';
  end if;

  if p_period_start is null or p_period_end is null or p_period_end <= p_period_start then
    raise exception 'reservation period is invalid';
  end if;

  if p_limit is null or p_limit <= 0 then
    return jsonb_build_object(
      'allowed', false,
      'reservation_id', null,
      'usage_count', 0,
      'limit', coalesce(p_limit, 0),
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

  if v_count is null then
    select usage_count
    into v_existing
    from public.usage_counters
    where user_id = p_user_id
      and action = p_action
      and period_start = p_period_start;

    return jsonb_build_object(
      'allowed', false,
      'reservation_id', null,
      'usage_count', coalesce(v_existing, 0),
      'limit', p_limit,
      'remaining', 0
    );
  end if;

  insert into public.ai_usage_reservations (
    user_id,
    action,
    period_start,
    period_end,
    status
  )
  values (
    p_user_id,
    p_action,
    p_period_start,
    p_period_end,
    'reserved'
  )
  returning id into v_reservation_id;

  return jsonb_build_object(
    'allowed', true,
    'reservation_id', v_reservation_id,
    'usage_count', v_count,
    'limit', p_limit,
    'remaining', greatest(p_limit - v_count, 0)
  );
end;
$$;

create or replace function public.release_tool_reservation(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid;
  v_action text;
  v_period_start timestamptz;
  v_status text;
  v_count integer;
begin
  if p_reservation_id is null then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  update public.ai_usage_reservations
  set
    status = 'released',
    updated_at = timezone('utc', now())
  where id = p_reservation_id
    and status = 'reserved'
    and action = 'tool_operation'
  returning user_id, action, period_start
  into v_user_id, v_action, v_period_start;

  if v_user_id is not null then
    update public.usage_counters
    set usage_count = usage_count - 1
    where user_id = v_user_id
      and action = v_action
      and period_start = v_period_start
      and usage_count > 0
    returning usage_count into v_count;

    if v_count is null then
      raise exception 'usage counter could not be decremented';
    end if;

    return jsonb_build_object('outcome', 'released');
  end if;

  select status
  into v_status
  from public.ai_usage_reservations
  where id = p_reservation_id
    and action = 'tool_operation';

  if v_status = 'released' then
    return jsonb_build_object('outcome', 'already_released');
  elsif v_status = 'committed' then
    return jsonb_build_object('outcome', 'already_committed');
  end if;

  return jsonb_build_object('outcome', 'not_found');
end;
$$;

create or replace function public.commit_tool_reservation(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
  v_status text;
begin
  if p_reservation_id is null then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  update public.ai_usage_reservations
  set
    status = 'committed',
    updated_at = timezone('utc', now())
  where id = p_reservation_id
    and status = 'reserved'
    and action = 'tool_operation'
  returning id into v_id;

  if v_id is not null then
    return jsonb_build_object('outcome', 'committed');
  end if;

  select status
  into v_status
  from public.ai_usage_reservations
  where id = p_reservation_id
    and action = 'tool_operation';

  if v_status = 'committed' then
    return jsonb_build_object('outcome', 'already_committed');
  elsif v_status = 'released' then
    return jsonb_build_object('outcome', 'already_released');
  end if;

  return jsonb_build_object('outcome', 'not_found');
end;
$$;

revoke all on function public.reserve_tool_operation(uuid, text, timestamptz, timestamptz, integer) from public;
revoke all on function public.reserve_tool_operation(uuid, text, timestamptz, timestamptz, integer) from anon;
revoke all on function public.reserve_tool_operation(uuid, text, timestamptz, timestamptz, integer) from authenticated;
grant execute on function public.reserve_tool_operation(uuid, text, timestamptz, timestamptz, integer) to service_role;

revoke all on function public.release_tool_reservation(uuid) from public;
revoke all on function public.release_tool_reservation(uuid) from anon;
revoke all on function public.release_tool_reservation(uuid) from authenticated;
grant execute on function public.release_tool_reservation(uuid) to service_role;

revoke all on function public.commit_tool_reservation(uuid) from public;
revoke all on function public.commit_tool_reservation(uuid) from anon;
revoke all on function public.commit_tool_reservation(uuid) from authenticated;
grant execute on function public.commit_tool_reservation(uuid) to service_role;
