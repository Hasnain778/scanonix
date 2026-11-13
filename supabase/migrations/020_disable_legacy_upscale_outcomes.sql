-- FIX-04 disables unscoped upscale completion and failure.
-- Forward-only. Do not edit migrations 013-019.
-- The signatures stay so an old caller receives a structured rejection.
-- These bodies do not read or write jobs, counters, or refunds.

create or replace function public.fail_upscale_job(
  p_job_id uuid,
  p_error_code text,
  p_error_message text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return jsonb_build_object('outcome', 'rejected');
end;
$$;

revoke all on function public.fail_upscale_job(uuid, text, text) from public;
revoke all on function public.fail_upscale_job(uuid, text, text) from anon;
revoke all on function public.fail_upscale_job(uuid, text, text) from authenticated;
revoke all on function public.fail_upscale_job(uuid, text, text) from service_role;

create or replace function public.complete_upscale_job(
  p_job_id uuid,
  p_output_storage_path text,
  p_output_width integer,
  p_output_height integer,
  p_output_format text,
  p_output_size_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return jsonb_build_object('outcome', 'rejected');
end;
$$;

revoke all on function public.complete_upscale_job(uuid, text, integer, integer, text, bigint) from public;
revoke all on function public.complete_upscale_job(uuid, text, integer, integer, text, bigint) from anon;
revoke all on function public.complete_upscale_job(uuid, text, integer, integer, text, bigint) from authenticated;
revoke all on function public.complete_upscale_job(uuid, text, integer, integer, text, bigint) from service_role;
