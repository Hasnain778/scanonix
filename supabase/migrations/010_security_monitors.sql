-- Scheduled security monitoring for websites

create table if not exists public.security_monitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_url text not null,
  label text,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  status text not null default 'active' check (status in ('active', 'paused')),
  last_scan_at timestamptz,
  next_scan_at timestamptz,
  last_scan_id uuid references public.scan_history (id) on delete set null,
  last_risk_score integer check (last_risk_score >= 0 and last_risk_score <= 100),
  last_findings_hash text,
  last_snapshot jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists security_monitors_user_id_idx
  on public.security_monitors (user_id, created_at desc);

create index if not exists security_monitors_due_idx
  on public.security_monitors (status, next_scan_at)
  where status = 'active';

create unique index if not exists security_monitors_user_url_idx
  on public.security_monitors (user_id, lower(target_url));

alter table public.security_monitors enable row level security;

drop policy if exists "Users can read own monitors" on public.security_monitors;
create policy "Users can read own monitors"
  on public.security_monitors for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own monitors" on public.security_monitors;
create policy "Users can insert own monitors"
  on public.security_monitors for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own monitors" on public.security_monitors;
create policy "Users can update own monitors"
  on public.security_monitors for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own monitors" on public.security_monitors;
create policy "Users can delete own monitors"
  on public.security_monitors for delete using (auth.uid() = user_id);

drop trigger if exists on_security_monitors_updated on public.security_monitors;
create trigger on_security_monitors_updated
  before update on public.security_monitors
  for each row execute function public.handle_updated_at();

-- Individual monitor scan runs
create table if not exists public.monitor_runs (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.security_monitors (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_history_id uuid references public.scan_history (id) on delete set null,
  status text not null check (status in ('completed', 'failed', 'skipped')),
  risk_score integer check (risk_score >= 0 and risk_score <= 100),
  previous_risk_score integer check (previous_risk_score >= 0 and previous_risk_score <= 100),
  findings_hash text,
  snapshot jsonb,
  changes jsonb,
  error_message text,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists monitor_runs_monitor_created_idx
  on public.monitor_runs (monitor_id, created_at desc);

alter table public.monitor_runs enable row level security;

drop policy if exists "Users can read own monitor runs" on public.monitor_runs;
create policy "Users can read own monitor runs"
  on public.monitor_runs for select using (auth.uid() = user_id);

-- Timeline / audit events
create table if not exists public.monitor_events (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.security_monitors (id) on delete cascade,
  monitor_run_id uuid references public.monitor_runs (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text not null,
  payload jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists monitor_events_monitor_created_idx
  on public.monitor_events (monitor_id, created_at desc);

create index if not exists monitor_events_user_created_idx
  on public.monitor_events (user_id, created_at desc);

alter table public.monitor_events enable row level security;

drop policy if exists "Users can read own monitor events" on public.monitor_events;
create policy "Users can read own monitor events"
  on public.monitor_events for select using (auth.uid() = user_id);

-- In-app notifications
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  monitor_id uuid references public.security_monitors (id) on delete set null,
  title text not null,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.user_notifications;
create policy "Users can read own notifications"
  on public.user_notifications for select using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.user_notifications;
create policy "Users can update own notifications"
  on public.user_notifications for update using (auth.uid() = user_id);

-- Webhook-ready async notification queue (service role writes)
create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  monitor_id uuid references public.security_monitors (id) on delete set null,
  channel text not null check (channel in ('email', 'in_app', 'webhook')),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

create index if not exists notification_queue_pending_idx
  on public.notification_queue (status, created_at asc)
  where status = 'pending';

-- Background job queue for scheduled scans (non-blocking cron design)
create table if not exists public.monitor_job_queue (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.security_monitors (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  scheduled_for timestamptz not null default timezone('utc', now()),
  attempts integer not null default 0,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

create index if not exists monitor_job_queue_pending_idx
  on public.monitor_job_queue (status, scheduled_for asc)
  where status = 'pending';

comment on table public.security_monitors is 'Scheduled website security monitors';
comment on table public.monitor_job_queue is 'Async job queue for scheduled monitor scans';
