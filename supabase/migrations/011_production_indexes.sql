-- Production query performance and monitor job idempotency

create index if not exists scan_history_created_at_idx
  on public.scan_history (created_at desc);

create index if not exists profiles_created_at_idx
  on public.profiles (created_at desc);

-- Prevent duplicate active jobs for the same monitor (cron idempotency)
create unique index if not exists monitor_job_queue_active_monitor_uidx
  on public.monitor_job_queue (monitor_id)
  where status in ('pending', 'processing');
