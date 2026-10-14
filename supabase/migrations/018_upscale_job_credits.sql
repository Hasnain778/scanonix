-- Upscaler credit lifecycle. Apply to the local Docker database only until reviewed.
-- Does not change consume_tool_usage or AI reservation functions.
-- Charged jobs share public.usage_counters (user_id, action, period_start).

alter table public.upscale_jobs
  add column if not exists usage_period_start timestamptz,
  add column if not exists usage_refunded boolean not null default false;

comment on column public.upscale_jobs.usage_period_start is
  'usage_counters period_start captured when this job was charged';

comment on column public.upscale_jobs.usage_refunded is
  'True after a permanent failure refund. Blocks a later completion or second charge.';

-- Direct table updates cannot charge, refund, reverse a refund, or complete a terminal job.
create or replace function public.protect_upscale_job_outcome()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    if new.usage_charged or new.usage_refunded then
      raise exception 'new upscale jobs must start uncharged';
    end if;
    return new;
  end if;

  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.usage_charged and not old.usage_charged
     and coalesce(current_setting('scanonix.upscale_credit', true), '') is distinct from 'charge' then
    raise exception 'upscale job must be charged through charge_upscale_job';
  end if;

  if old.usage_charged and not new.usage_charged
     and coalesce(current_setting('scanonix.upscale_credit', true), '') is distinct from 'refund' then
    raise exception 'upscale job must be refunded through refund_upscale_job';
  end if;

  if new.usage_refunded and not old.usage_refunded
     and coalesce(current_setting('scanonix.upscale_credit', true), '') is distinct from 'refund' then
    raise exception 'upscale job must be refunded through refund_upscale_job';
  end if;

  if old.usage_refunded and not new.usage_refunded then
    raise exception 'upscale job refund cannot be reversed';
  end if;

  if old.usage_refunded and new.usage_charged then
    raise exception 'refunded upscale job cannot be charged';
  end if;

  if old.usage_refunded and new.status = 'completed' then
    raise exception 'refunded upscale job cannot be completed';
  end if;

  if old.status = 'completed' and new.status is distinct from 'completed' then
    raise exception 'completed upscale job cannot change status';
  end if;

  if old.status in ('failed', 'cancelled') and new.status = 'completed' then
    raise exception 'terminal upscale job cannot be completed';
  end if;

  return new;
end;
$$;

drop trigger if exists upscale_jobs_protect_outcome on public.upscale_jobs;
create trigger upscale_jobs_protect_outcome
  before insert or update on public.upscale_jobs
  for each row
  execute function public.protect_upscale_job_outcome();

revoke all on function public.protect_upscale_job_outcome() from public;
revoke all on function public.protect_upscale_job_outcome() from anon;
revoke all on function public.protect_upscale_job_outcome() from authenticated;

-- Claim only a queued job that still holds a charge. Uncharged and refunded jobs stay idle.
create or replace function public.claim_upscale_job(p_worker_id text)
returns setof public.upscale_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.upscale_jobs;
begin
  select *
  into v_job
  from public.upscale_jobs
  where status = 'queued'
    and usage_charged = true
    and usage_refunded = false
  order by created_at asc
  limit 1
  for update skip locked;

  if not found then
    return;
  end if;

  update public.upscale_jobs
  set
    status = 'processing',
    stage = 'upscaling',
    progress = greatest(progress, 25),
    started_at = timezone('utc', now()),
    attempts = attempts + 1,
    worker_id = p_worker_id
  where id = v_job.id
    and status = 'queued'
    and usage_charged = true
    and usage_refunded = false
  returning * into v_job;

  if not found then
    return;
  end if;

  return next v_job;
end;
$$;

revoke all on function public.claim_upscale_job(text) from public;
revoke all on function public.claim_upscale_job(text) from anon;
revoke all on function public.claim_upscale_job(text) from authenticated;
grant execute on function public.claim_upscale_job(text) to service_role;

create or replace function public.charge_upscale_job(
  p_job_id uuid,
  p_user_id uuid,
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
  v_job public.upscale_jobs;
  v_count integer;
  v_existing integer;
begin
  if p_job_id is null or p_user_id is null then
    return jsonb_build_object('outcome', 'not_found', 'allowed', false);
  end if;

  if p_period_start is null or p_period_end is null or p_period_end <= p_period_start then
    raise exception 'upscale charge period is invalid';
  end if;

  select *
  into v_job
  from public.upscale_jobs
  where id = p_job_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found', 'allowed', false);
  end if;

  if v_job.user_id is distinct from p_user_id then
    return jsonb_build_object('outcome', 'forbidden', 'allowed', false);
  end if;

  if v_job.usage_refunded then
    return jsonb_build_object('outcome', 'refunded', 'allowed', false);
  end if;

  if v_job.usage_charged then
    return jsonb_build_object(
      'outcome', 'already_charged',
      'allowed', true,
      'usage_count', null,
      'limit', p_limit,
      'remaining', null
    );
  end if;

  if v_job.status is distinct from 'queued' then
    return jsonb_build_object('outcome', 'not_chargeable', 'allowed', false);
  end if;

  if p_limit is null or p_limit <= 0 then
    return jsonb_build_object(
      'outcome', 'denied',
      'allowed', false,
      'usage_count', 0,
      'limit', coalesce(p_limit, 0),
      'remaining', 0
    );
  end if;

  insert into public.usage_counters (user_id, action, period_start, period_end, usage_count)
  values (p_user_id, 'tool_operation', p_period_start, p_period_end, 0)
  on conflict (user_id, action, period_start) do nothing;

  update public.usage_counters
  set usage_count = usage_count + 1
  where user_id = p_user_id
    and action = 'tool_operation'
    and period_start = p_period_start
    and usage_count < p_limit
  returning usage_count into v_count;

  if v_count is null then
    select usage_count
    into v_existing
    from public.usage_counters
    where user_id = p_user_id
      and action = 'tool_operation'
      and period_start = p_period_start;

    return jsonb_build_object(
      'outcome', 'denied',
      'allowed', false,
      'usage_count', coalesce(v_existing, 0),
      'limit', p_limit,
      'remaining', 0
    );
  end if;

  perform set_config('scanonix.upscale_credit', 'charge', true);

  update public.upscale_jobs
  set
    usage_charged = true,
    usage_period_start = p_period_start
  where id = p_job_id
    and user_id = p_user_id
    and status = 'queued'
    and usage_charged = false
    and usage_refunded = false;

  if not found then
    raise exception 'upscale job charge could not be recorded';
  end if;

  return jsonb_build_object(
    'outcome', 'charged',
    'allowed', true,
    'usage_count', v_count,
    'limit', p_limit,
    'remaining', greatest(p_limit - v_count, 0)
  );
end;
$$;

revoke all on function public.charge_upscale_job(uuid, uuid, timestamptz, timestamptz, integer) from public;
revoke all on function public.charge_upscale_job(uuid, uuid, timestamptz, timestamptz, integer) from anon;
revoke all on function public.charge_upscale_job(uuid, uuid, timestamptz, timestamptz, integer) from authenticated;
grant execute on function public.charge_upscale_job(uuid, uuid, timestamptz, timestamptz, integer) to service_role;

create or replace function public.refund_upscale_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.upscale_jobs;
  v_count integer;
begin
  if p_job_id is null then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  select *
  into v_job
  from public.upscale_jobs
  where id = p_job_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if v_job.usage_refunded then
    return jsonb_build_object('outcome', 'already_refunded');
  end if;

  if v_job.status = 'completed' then
    return jsonb_build_object('outcome', 'not_refundable');
  end if;

  if v_job.status not in ('failed', 'cancelled') then
    return jsonb_build_object('outcome', 'not_terminal');
  end if;

  if not v_job.usage_charged then
    return jsonb_build_object('outcome', 'not_charged');
  end if;

  if v_job.usage_period_start is null then
    return jsonb_build_object('outcome', 'period_unknown');
  end if;

  update public.usage_counters
  set usage_count = usage_count - 1
  where user_id = v_job.user_id
    and action = 'tool_operation'
    and period_start = v_job.usage_period_start
    and usage_count > 0
  returning usage_count into v_count;

  perform set_config('scanonix.upscale_credit', 'refund', true);

  update public.upscale_jobs
  set
    usage_charged = false,
    usage_refunded = true
  where id = p_job_id
    and usage_charged = true
    and usage_refunded = false
    and status in ('failed', 'cancelled');

  if not found then
    raise exception 'upscale job refund could not be recorded';
  end if;

  return jsonb_build_object(
    'outcome', case when v_count is null then 'refunded_without_decrement' else 'refunded' end
  );
end;
$$;

revoke all on function public.refund_upscale_job(uuid) from public;
revoke all on function public.refund_upscale_job(uuid) from anon;
revoke all on function public.refund_upscale_job(uuid) from authenticated;
grant execute on function public.refund_upscale_job(uuid) to service_role;

create or replace function public.fail_upscale_job(
  p_job_id uuid,
  p_error_code text,
  p_error_message text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.upscale_jobs;
  v_refund jsonb;
begin
  if p_job_id is null then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  select *
  into v_job
  from public.upscale_jobs
  where id = p_job_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if v_job.status = 'completed' then
    return jsonb_build_object('outcome', 'completed');
  end if;

  if v_job.usage_refunded then
    return jsonb_build_object('outcome', 'already_refunded');
  end if;

  if v_job.status in ('queued', 'processing') then
    update public.upscale_jobs
    set
      status = 'failed',
      error_code = left(coalesce(p_error_code, 'upscale_failed'), 80),
      error_message = left(coalesce(p_error_message, 'Image upscaling failed.'), 500),
      completed_at = timezone('utc', now()),
      worker_id = null
    where id = p_job_id
      and status in ('queued', 'processing')
      and usage_refunded = false
      and status is distinct from 'completed';

    if not found then
      return jsonb_build_object('outcome', 'completed');
    end if;
  end if;

  v_refund := public.refund_upscale_job(p_job_id);
  return v_refund;
end;
$$;

revoke all on function public.fail_upscale_job(uuid, text, text) from public;
revoke all on function public.fail_upscale_job(uuid, text, text) from anon;
revoke all on function public.fail_upscale_job(uuid, text, text) from authenticated;
grant execute on function public.fail_upscale_job(uuid, text, text) to service_role;

create or replace function public.close_uncharged_upscale_job(
  p_job_id uuid,
  p_error_code text,
  p_error_message text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.upscale_jobs;
begin
  if p_job_id is null then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  select *
  into v_job
  from public.upscale_jobs
  where id = p_job_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if v_job.usage_refunded then
    return jsonb_build_object('outcome', 'refunded');
  end if;

  if v_job.usage_charged then
    return jsonb_build_object('outcome', 'charged');
  end if;

  if v_job.status is distinct from 'queued' then
    return jsonb_build_object('outcome', 'unchanged');
  end if;

  update public.upscale_jobs
  set
    status = 'cancelled',
    error_code = left(coalesce(p_error_code, 'upscale_cancelled'), 80),
    error_message = left(coalesce(p_error_message, 'Upscale job was not started.'), 500),
    completed_at = timezone('utc', now())
  where id = p_job_id
    and status = 'queued'
    and usage_charged = false
    and usage_refunded = false;

  if not found then
    return jsonb_build_object('outcome', 'unchanged');
  end if;

  return jsonb_build_object('outcome', 'cancelled');
end;
$$;

revoke all on function public.close_uncharged_upscale_job(uuid, text, text) from public;
revoke all on function public.close_uncharged_upscale_job(uuid, text, text) from anon;
revoke all on function public.close_uncharged_upscale_job(uuid, text, text) from authenticated;
grant execute on function public.close_uncharged_upscale_job(uuid, text, text) to service_role;

create or replace function public.complete_upscale_job(
  p_job_id uuid,
  p_output_storage_path text,
  p_output_width integer,
  p_output_height integer,
  p_output_format text,
  p_output_size_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.upscale_jobs;
begin
  if p_job_id is null then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  select *
  into v_job
  from public.upscale_jobs
  where id = p_job_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if v_job.status = 'completed' then
    return jsonb_build_object('outcome', 'already_completed');
  end if;

  if v_job.usage_refunded or v_job.status in ('failed', 'cancelled') then
    return jsonb_build_object('outcome', 'rejected');
  end if;

  if v_job.status not in ('queued', 'processing') or not v_job.usage_charged then
    return jsonb_build_object('outcome', 'rejected');
  end if;

  update public.upscale_jobs
  set
    status = 'completed',
    stage = 'completed',
    progress = 100,
    output_storage_path = p_output_storage_path,
    output_width = p_output_width,
    output_height = p_output_height,
    output_format = p_output_format,
    output_size_bytes = p_output_size_bytes,
    completed_at = timezone('utc', now()),
    error_code = null,
    error_message = null
  where id = p_job_id
    and status in ('queued', 'processing')
    and usage_charged = true
    and usage_refunded = false;

  if not found then
    return jsonb_build_object('outcome', 'rejected');
  end if;

  return jsonb_build_object('outcome', 'completed');
end;
$$;

revoke all on function public.complete_upscale_job(uuid, text, integer, integer, text, bigint) from public;
revoke all on function public.complete_upscale_job(uuid, text, integer, integer, text, bigint) from anon;
revoke all on function public.complete_upscale_job(uuid, text, integer, integer, text, bigint) from authenticated;
grant execute on function public.complete_upscale_job(uuid, text, integer, integer, text, bigint) to service_role;

-- Processing stale threshold stays caller-controlled (worker default 600s).
-- Queued abandonment is fixed at 6 hours so a RunPod cold start is not a failure.
-- Requeue does not refund. Permanent failure and already-failed charged jobs do.
create or replace function public.recover_stale_upscale_jobs(p_stale_after_seconds integer default 600)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_stale integer;
  v_requeued integer := 0;
  v_failed integer := 0;
  v_abandoned integer := 0;
  v_refunded integer := 0;
  v_job_id uuid;
  v_refund jsonb;
begin
  v_stale := p_stale_after_seconds;
  if v_stale is null or v_stale < 60 then
    v_stale := 600;
  end if;

  update public.upscale_jobs
  set
    status = 'queued',
    stage = 'queued',
    progress = 15,
    error_code = null,
    error_message = null,
    completed_at = null,
    worker_id = null,
    started_at = null
  where status = 'processing'
    and usage_refunded = false
    and started_at is not null
    and started_at < timezone('utc', now()) - make_interval(secs => v_stale)
    and attempts < max_attempts;

  get diagnostics v_requeued = row_count;

  update public.upscale_jobs
  set
    status = 'failed',
    error_code = 'processing_timeout',
    error_message = 'Processing timed out. Please try again.',
    completed_at = timezone('utc', now()),
    worker_id = null
  where status = 'processing'
    and usage_refunded = false
    and started_at is not null
    and started_at < timezone('utc', now()) - make_interval(secs => v_stale)
    and attempts >= max_attempts;

  get diagnostics v_failed = row_count;

  update public.upscale_jobs
  set
    status = 'failed',
    error_code = 'queued_abandoned',
    error_message = 'Upscale job was not picked up. The operation was not used.',
    completed_at = timezone('utc', now()),
    worker_id = null
  where status = 'queued'
    and usage_charged = true
    and usage_refunded = false
    and started_at is null
    and created_at < timezone('utc', now()) - interval '6 hours';

  get diagnostics v_abandoned = row_count;

  update public.upscale_jobs
  set
    status = 'cancelled',
    error_code = 'uncharged_abandoned',
    error_message = 'Upscale job was not charged.',
    completed_at = timezone('utc', now())
  where status = 'queued'
    and usage_charged = false
    and usage_refunded = false
    and created_at < timezone('utc', now()) - interval '6 hours';

  for v_job_id in
    select id
    from public.upscale_jobs
    where status in ('failed', 'cancelled')
      and usage_charged = true
      and usage_refunded = false
      and usage_period_start is not null
    order by created_at asc
    for update
  loop
    v_refund := public.refund_upscale_job(v_job_id);
    if v_refund->>'outcome' in ('refunded', 'refunded_without_decrement') then
      v_refunded := v_refunded + 1;
    end if;
  end loop;

  return v_requeued + v_failed + v_abandoned + v_refunded;
end;
$$;

revoke all on function public.recover_stale_upscale_jobs(integer) from public;
revoke all on function public.recover_stale_upscale_jobs(integer) from anon;
revoke all on function public.recover_stale_upscale_jobs(integer) from authenticated;
grant execute on function public.recover_stale_upscale_jobs(integer) to service_role;
