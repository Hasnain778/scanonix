-- Security tool usage tracking for Pro security features

create table if not exists public.security_tool_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tool_id text not null,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists security_tool_usage_user_created_idx
  on public.security_tool_usage (user_id, created_at desc);

create index if not exists security_tool_usage_tool_idx
  on public.security_tool_usage (tool_id, created_at desc);

alter table public.security_tool_usage enable row level security;

drop policy if exists "Users can read own security tool usage" on public.security_tool_usage;
create policy "Users can read own security tool usage"
  on public.security_tool_usage for select using (auth.uid() = user_id);

comment on table public.security_tool_usage is 'Audit log of Pro security tool operations per user';
