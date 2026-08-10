-- Extended profile fields, notification preferences, and account deletion requests

alter table public.profiles
  add column if not exists company_name text,
  add column if not exists job_title text,
  add column if not exists country text,
  add column if not exists time_zone text;

create table if not exists public.user_notification_preferences (
  user_id uuid references auth.users on delete cascade primary key,
  scan_completed boolean not null default true,
  high_risk_found boolean not null default true,
  weekly_summary boolean not null default true,
  billing_alerts boolean not null default true,
  product_updates boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_notification_preferences enable row level security;

drop policy if exists "Users can view own notification preferences" on public.user_notification_preferences;
create policy "Users can view own notification preferences"
  on public.user_notification_preferences
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification preferences" on public.user_notification_preferences;
create policy "Users can insert own notification preferences"
  on public.user_notification_preferences
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own notification preferences" on public.user_notification_preferences;
create policy "Users can update own notification preferences"
  on public.user_notification_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists on_notification_preferences_updated on public.user_notification_preferences;
create trigger on_notification_preferences_updated
  before update on public.user_notification_preferences
  for each row
  execute function public.handle_updated_at();

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  email text not null,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists account_deletion_requests_user_id_idx
  on public.account_deletion_requests (user_id);

alter table public.account_deletion_requests enable row level security;

drop policy if exists "Users can view own deletion requests" on public.account_deletion_requests;
create policy "Users can view own deletion requests"
  on public.account_deletion_requests
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own deletion requests" on public.account_deletion_requests;
create policy "Users can insert own deletion requests"
  on public.account_deletion_requests
  for insert
  with check (auth.uid() = user_id);
