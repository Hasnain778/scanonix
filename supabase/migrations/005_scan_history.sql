-- Scan history for authenticated users (idempotent)

create table if not exists public.scan_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target text not null,
  target_type text not null check (target_type in ('website', 'file')),
  risk_score integer not null default 0 check (risk_score >= 0 and risk_score <= 100),
  status text not null default 'completed' check (status in ('completed', 'processing', 'failed')),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  report_data jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists scan_history_user_id_created_at_idx
  on public.scan_history (user_id, created_at desc);

create index if not exists scan_history_user_id_risk_score_idx
  on public.scan_history (user_id, risk_score desc);

create index if not exists scan_history_user_id_target_type_idx
  on public.scan_history (user_id, target_type);

alter table public.scan_history enable row level security;

drop policy if exists "Users can read own scan history" on public.scan_history;
create policy "Users can read own scan history"
  on public.scan_history
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own scan history" on public.scan_history;
create policy "Users can insert own scan history"
  on public.scan_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own scan history" on public.scan_history;
create policy "Users can delete own scan history"
  on public.scan_history
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can update own scan history" on public.scan_history;
create policy "Users can update own scan history"
  on public.scan_history
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_scan_history_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists scan_history_set_updated_at on public.scan_history;
create trigger scan_history_set_updated_at
  before update on public.scan_history
  for each row
  execute function public.set_scan_history_updated_at();

create or replace function public.get_scan_history_summary()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'total_scans', count(*)::integer,
    'high_risk_scans', count(*) filter (where risk_score >= 51 and status <> 'failed')::integer,
    'clean_scans', count(*) filter (where risk_score <= 25 and status <> 'failed')::integer,
    'average_risk_score', coalesce(round(avg(risk_score) filter (where status <> 'failed'))::integer, 0)
  )
  from public.scan_history
  where user_id = auth.uid();
$$;

grant execute on function public.get_scan_history_summary() to authenticated;
