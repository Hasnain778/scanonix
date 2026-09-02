-- 132B-2: notification_queue processing claims + service-role-only RLS.
-- Forward-only. Does not edit 010_security_monitors.sql.

do $$
declare
  conname text;
begin
  select con.conname into conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'notification_queue'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%'
    and pg_get_constraintdef(con.oid) ilike '%pending%'
    and pg_get_constraintdef(con.oid) ilike '%sent%'
    and pg_get_constraintdef(con.oid) not ilike '%processing%';

  if conname is not null then
    execute format('alter table public.notification_queue drop constraint %I', conname);
  end if;
end
$$;

alter table public.notification_queue
  drop constraint if exists notification_queue_status_check;

alter table public.notification_queue
  add constraint notification_queue_status_check
  check (status in ('pending', 'processing', 'sent', 'failed'));

comment on column public.notification_queue.status is
  'pending → processing (atomic claim) → sent | failed. Failed is terminal in 132B-2 (no auto-retry).';

-- Deny anon/authenticated PostgREST access. service_role bypasses RLS.
alter table public.notification_queue enable row level security;
