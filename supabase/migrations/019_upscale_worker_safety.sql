-- FIX-04 worker safety. Forward-only. Do not edit migrations 013-018.
-- Apply to the local Docker database only until reviewed.
-- Keeps fail_upscale_job(uuid, text, text) and
-- complete_upscale_job(uuid, text, integer, integer, text, bigint)
-- so the deployed FIX-03 worker can keep calling them.
-- scanonix.upscale_job_write authorizes one UPDATE of status, attempts, or
-- worker_id. It is cleared before any later statement, including refunds.
-- It is not the credit flag scanonix.upscale_credit.

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

  if new.status is distinct from old.status
     or new.attempts is distinct from old.attempts
     or new.worker_id is distinct from old.worker_id
  then
    if coalesce(current_setting('scanonix.upscale_job_write', true), '') is distinct from 'write' then
      raise exception 'upscale job status, attempts, and worker_id must change through an upscale job function';
    end if;
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

-- Claim only a queued charged job that still has an attempt left.
create or replace function public.claim_upscale_job(p_worker_id text)
returns setof public.upscale_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.upscale_jobs;
  v_updated integer := 0;
begin
  if p_worker_id is null or btrim(p_worker_id) = '' then
    return;
  end if;

  select *
  into v_job
  from public.upscale_jobs
  where status = 'queued'
    and usage_charged = true
    and usage_refunded = false
    and attempts < max_attempts
  order by created_at asc
  limit 1
  for update skip locked;

  if not found then
    return;
  end if;

  perform set_config('scanonix.upscale_job_write', 'write', true);
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
    and attempts < max_attempts
  returning * into v_job;
  get diagnostics v_updated = row_count;
  perform set_config('scanonix.upscale_job_write', '', true);

  if v_updated = 0 then
    return;
  end if;

  return next v_job;
end;
$$;

revoke all on function public.claim_upscale_job(text) from public;
revoke all on function public.claim_upscale_job(text) from anon;
revoke all on function public.claim_upscale_job(text) from authenticated;
grant execute on function public.claim_upscale_job(text) to service_role;

-- FIX-03 signature stays. Ownership is enforced by fail_owned_upscale_job.
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
  v_updated integer := 0;
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
    perform set_config('scanonix.upscale_job_write', 'write', true);
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
    get diagnostics v_updated = row_count;
    perform set_config('scanonix.upscale_job_write', '', true);

    if v_updated = 0 then
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
  v_updated integer := 0;
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

  perform set_config('scanonix.upscale_job_write', 'write', true);
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
  get diagnostics v_updated = row_count;
  perform set_config('scanonix.upscale_job_write', '', true);

  if v_updated = 0 then
    return jsonb_build_object('outcome', 'unchanged');
  end if;

  return jsonb_build_object('outcome', 'cancelled');
end;
$$;

revoke all on function public.close_uncharged_upscale_job(uuid, text, text) from public;
revoke all on function public.close_uncharged_upscale_job(uuid, text, text) from anon;
revoke all on function public.close_uncharged_upscale_job(uuid, text, text) from authenticated;
grant execute on function public.close_uncharged_upscale_job(uuid, text, text) to service_role;

-- FIX-03 signature stays. Ownership is enforced by complete_owned_upscale_job.
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
  v_updated integer := 0;
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

  perform set_config('scanonix.upscale_job_write', 'write', true);
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
  get diagnostics v_updated = row_count;
  perform set_config('scanonix.upscale_job_write', '', true);

  if v_updated = 0 then
    return jsonb_build_object('outcome', 'rejected');
  end if;

  return jsonb_build_object('outcome', 'completed');
end;
$$;

revoke all on function public.complete_upscale_job(uuid, text, integer, integer, text, bigint) from public;
revoke all on function public.complete_upscale_job(uuid, text, integer, integer, text, bigint) from anon;
revoke all on function public.complete_upscale_job(uuid, text, integer, integer, text, bigint) from authenticated;
grant execute on function public.complete_upscale_job(uuid, text, integer, integer, text, bigint) to service_role;

-- Fail and refund only an unclaimed charged queued job. A claim that wins returns in_progress.
create or replace function public.abort_unclaimed_upscale_job(
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
  v_updated integer := 0;
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

  if v_job.status = 'queued'
     and v_job.worker_id is null
     and v_job.started_at is null
     and v_job.usage_charged
  then
    perform set_config('scanonix.upscale_job_write', 'write', true);
    update public.upscale_jobs
    set
      status = 'failed',
      error_code = left(coalesce(p_error_code, 'worker_trigger_failed'), 80),
      error_message = left(coalesce(p_error_message, 'Could not start upscaling worker. Please try again.'), 500),
      completed_at = timezone('utc', now()),
      worker_id = null
    where id = p_job_id
      and status = 'queued'
      and worker_id is null
      and started_at is null
      and usage_charged = true
      and usage_refunded = false;
    get diagnostics v_updated = row_count;
    perform set_config('scanonix.upscale_job_write', '', true);

    if v_updated = 0 then
      return jsonb_build_object('outcome', 'in_progress');
    end if;

    v_refund := public.refund_upscale_job(p_job_id);
    return v_refund;
  end if;

  if v_job.status = 'processing'
     or (
       v_job.status = 'queued'
       and (v_job.worker_id is not null or v_job.started_at is not null)
     )
  then
    return jsonb_build_object('outcome', 'in_progress');
  end if;

  return jsonb_build_object('outcome', 'unchanged');
end;
$$;

revoke all on function public.abort_unclaimed_upscale_job(uuid, text, text) from public;
revoke all on function public.abort_unclaimed_upscale_job(uuid, text, text) from anon;
revoke all on function public.abort_unclaimed_upscale_job(uuid, text, text) from authenticated;
grant execute on function public.abort_unclaimed_upscale_job(uuid, text, text) to service_role;

create or replace function public.fail_owned_upscale_job(
  p_job_id uuid,
  p_worker_id text,
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
  v_updated integer := 0;
begin
  if p_job_id is null then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if p_worker_id is null or btrim(p_worker_id) = '' then
    return jsonb_build_object('outcome', 'not_owner');
  end if;

  select *
  into v_job
  from public.upscale_jobs
  where id = p_job_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if v_job.worker_id is distinct from p_worker_id then
    return jsonb_build_object('outcome', 'not_owner');
  end if;

  if v_job.status = 'completed' then
    return jsonb_build_object('outcome', 'completed');
  end if;

  if v_job.usage_refunded then
    return jsonb_build_object('outcome', 'already_refunded');
  end if;

  if v_job.status is distinct from 'processing' then
    return jsonb_build_object('outcome', 'not_owner');
  end if;

  perform set_config('scanonix.upscale_job_write', 'write', true);
  update public.upscale_jobs
  set
    status = 'failed',
    error_code = left(coalesce(p_error_code, 'upscale_failed'), 80),
    error_message = left(coalesce(p_error_message, 'Image upscaling failed.'), 500),
    completed_at = timezone('utc', now()),
    worker_id = null
  where id = p_job_id
    and status = 'processing'
    and worker_id = p_worker_id
    and usage_refunded = false;
  get diagnostics v_updated = row_count;
  perform set_config('scanonix.upscale_job_write', '', true);

  if v_updated = 0 then
    return jsonb_build_object('outcome', 'not_owner');
  end if;

  v_refund := public.refund_upscale_job(p_job_id);
  return v_refund;
end;
$$;

revoke all on function public.fail_owned_upscale_job(uuid, text, text, text) from public;
revoke all on function public.fail_owned_upscale_job(uuid, text, text, text) from anon;
revoke all on function public.fail_owned_upscale_job(uuid, text, text, text) from authenticated;
grant execute on function public.fail_owned_upscale_job(uuid, text, text, text) to service_role;

create or replace function public.complete_owned_upscale_job(
  p_job_id uuid,
  p_worker_id text,
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
  v_updated integer := 0;
begin
  if p_job_id is null then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if p_worker_id is null or btrim(p_worker_id) = '' then
    return jsonb_build_object('outcome', 'not_owner');
  end if;

  select *
  into v_job
  from public.upscale_jobs
  where id = p_job_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if v_job.worker_id is distinct from p_worker_id then
    return jsonb_build_object('outcome', 'not_owner');
  end if;

  if v_job.status = 'completed' then
    return jsonb_build_object('outcome', 'already_completed');
  end if;

  if v_job.usage_refunded or v_job.status in ('failed', 'cancelled') then
    return jsonb_build_object('outcome', 'rejected');
  end if;

  if v_job.status is distinct from 'processing' or not v_job.usage_charged then
    return jsonb_build_object('outcome', 'rejected');
  end if;

  perform set_config('scanonix.upscale_job_write', 'write', true);
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
    and status = 'processing'
    and worker_id = p_worker_id
    and usage_charged = true
    and usage_refunded = false;
  get diagnostics v_updated = row_count;
  perform set_config('scanonix.upscale_job_write', '', true);

  if v_updated = 0 then
    return jsonb_build_object('outcome', 'not_owner');
  end if;

  return jsonb_build_object('outcome', 'completed');
end;
$$;

revoke all on function public.complete_owned_upscale_job(uuid, text, text, integer, integer, text, bigint) from public;
revoke all on function public.complete_owned_upscale_job(uuid, text, text, integer, integer, text, bigint) from anon;
revoke all on function public.complete_owned_upscale_job(uuid, text, text, integer, integer, text, bigint) from authenticated;
grant execute on function public.complete_owned_upscale_job(uuid, text, text, integer, integer, text, bigint) to service_role;

-- Processing stale threshold stays caller-controlled (worker default 600s).
-- Queued abandonment is fixed at 6 hours so a RunPod cold start is not a failure.
-- Requeue does not refund. Refunds apply only to jobs this call marks failed.
-- Historical failed or cancelled jobs are left unchanged.
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
  v_refund_ids uuid[] := '{}';
  v_batch uuid[] := '{}';
begin
  v_stale := p_stale_after_seconds;
  if v_stale is null or v_stale < 60 then
    v_stale := 600;
  end if;

  perform set_config('scanonix.upscale_job_write', 'write', true);
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
  perform set_config('scanonix.upscale_job_write', '', true);

  perform set_config('scanonix.upscale_job_write', 'write', true);
  with marked as (
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
      and attempts >= max_attempts
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]), count(*)::integer
  into v_batch, v_failed
  from marked;
  perform set_config('scanonix.upscale_job_write', '', true);
  v_refund_ids := v_refund_ids || v_batch;

  perform set_config('scanonix.upscale_job_write', 'write', true);
  with marked as (
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
      and created_at < timezone('utc', now()) - interval '6 hours'
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]), count(*)::integer
  into v_batch, v_abandoned
  from marked;
  perform set_config('scanonix.upscale_job_write', '', true);
  v_refund_ids := v_refund_ids || v_batch;

  perform set_config('scanonix.upscale_job_write', 'write', true);
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
  perform set_config('scanonix.upscale_job_write', '', true);

  foreach v_job_id in array v_refund_ids
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
