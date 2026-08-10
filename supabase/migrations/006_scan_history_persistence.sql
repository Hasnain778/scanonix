-- Scan history persistence metadata (idempotent)

alter table public.scan_history
  add column if not exists findings_count integer not null default 0,
  add column if not exists error_message text,
  add column if not exists scan_token text;

create unique index if not exists scan_history_user_scan_token_uidx
  on public.scan_history (user_id, scan_token)
  where scan_token is not null;
