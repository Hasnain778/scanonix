-- Async image upscaler jobs (Phase 8F)
-- Apply manually in Supabase — do not auto-run in production from CI.

create table if not exists public.upscale_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'completed', 'failed', 'cancelled')
  ),
  scale smallint not null check (scale in (2, 4)),
  stage text not null default 'preparing' check (
    stage in ('preparing', 'queued', 'upscaling', 'preparing_result', 'finalizing', 'completed')
  ),
  progress smallint not null default 0 check (progress >= 0 and progress <= 100),
  input_storage_path text not null,
  output_storage_path text,
  input_mime_type text not null,
  input_width integer not null check (input_width > 0),
  input_height integer not null check (input_height > 0),
  input_size_bytes bigint not null check (input_size_bytes > 0),
  output_width integer check (output_width is null or output_width > 0),
  output_height integer check (output_height is null or output_height > 0),
  output_format text check (output_format is null or output_format in ('png', 'jpeg', 'jpg', 'webp')),
  output_size_bytes bigint check (output_size_bytes is null or output_size_bytes >= 0),
  error_code text,
  error_message text,
  usage_charged boolean not null default false,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts >= 1),
  worker_id text,
  created_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '24 hours')
);

create index if not exists upscale_jobs_user_created_idx
  on public.upscale_jobs (user_id, created_at desc);

create index if not exists upscale_jobs_queued_idx
  on public.upscale_jobs (status, created_at asc)
  where status = 'queued';

create index if not exists upscale_jobs_processing_stale_idx
  on public.upscale_jobs (status, started_at)
  where status = 'processing';

create index if not exists upscale_jobs_expires_idx
  on public.upscale_jobs (expires_at)
  where status = 'completed';

alter table public.upscale_jobs enable row level security;

drop policy if exists "Users can read own upscale jobs" on public.upscale_jobs;
create policy "Users can read own upscale jobs"
  on public.upscale_jobs for select
  to authenticated
  using (auth.uid() = user_id);

-- No insert/update/delete for authenticated users — server/worker use service role.

comment on table public.upscale_jobs is 'Async Real-ESRGAN upscale jobs with private storage paths';

-- Atomically claim the next queued job (service role / worker only).
create or replace function public.claim_upscale_job(p_worker_id text)
returns setof public.upscale_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.upscale_jobs;
begin
  select *
  into v_job
  from public.upscale_jobs
  where status = 'queued'
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
  returning * into v_job;

  return next v_job;
end;
$$;

revoke all on function public.claim_upscale_job(text) from public;
grant execute on function public.claim_upscale_job(text) to service_role;

-- Requeue stale processing jobs or mark failed after max attempts.
create or replace function public.recover_stale_upscale_jobs(p_stale_after_seconds integer default 600)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.upscale_jobs
  set
    status = case when attempts >= max_attempts then 'failed' else 'queued' end,
    stage = case when attempts >= max_attempts then stage else 'queued' end,
    progress = case when attempts >= max_attempts then progress else 15 end,
    error_code = case when attempts >= max_attempts then 'processing_timeout' else null end,
    error_message = case
      when attempts >= max_attempts then 'Processing timed out. Please try again.'
      else null
    end,
    completed_at = case when attempts >= max_attempts then timezone('utc', now()) else null end,
    worker_id = null,
    started_at = null
  where status = 'processing'
    and started_at is not null
    and started_at < timezone('utc', now()) - make_interval(secs => p_stale_after_seconds);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.recover_stale_upscale_jobs(integer) from public;
grant execute on function public.recover_stale_upscale_jobs(integer) to service_role;
