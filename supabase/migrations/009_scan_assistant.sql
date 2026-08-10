-- Scan Security Copilot conversation history (per report, per user)

create table if not exists public.scan_assistant_messages (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scan_history (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  source text check (source in ('ai', 'deterministic')),
  tokens_used integer,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists scan_assistant_messages_scan_created_idx
  on public.scan_assistant_messages (scan_id, created_at asc);

create index if not exists scan_assistant_messages_user_scan_idx
  on public.scan_assistant_messages (user_id, scan_id);

alter table public.scan_assistant_messages enable row level security;

drop policy if exists "Users can read own assistant messages" on public.scan_assistant_messages;
create policy "Users can read own assistant messages"
  on public.scan_assistant_messages
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own assistant messages" on public.scan_assistant_messages;
create policy "Users can insert own assistant messages"
  on public.scan_assistant_messages
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own assistant messages" on public.scan_assistant_messages;
create policy "Users can delete own assistant messages"
  on public.scan_assistant_messages
  for delete
  using (auth.uid() = user_id);

comment on table public.scan_assistant_messages is 'Security Copilot chat history scoped to scan reports';
