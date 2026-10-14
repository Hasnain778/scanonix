-- Ensure monitor_job_queue is protected in fresh deployments.
-- The production table already has RLS enabled.
-- Application access uses the service-role client.

alter table public.monitor_job_queue enable row level security;

revoke all on table public.monitor_job_queue from anon;
revoke all on table public.monitor_job_queue from authenticated;
