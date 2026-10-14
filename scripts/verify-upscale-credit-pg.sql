-- Local Docker only. Every scenario rolls back its own rows.
\set ON_ERROR_STOP on
SET client_min_messages TO notice;

-- 1. Charge an eligible job once. A second charge does not increment.
BEGIN;
DO $$
DECLARE
  v_user uuid := '01800000-0000-4000-8000-0000000000a1';
  v_job uuid := '01800000-0000-4000-8000-0000000000a2';
  v_start timestamptz := '2026-10-01 00:00:00+00';
  v_end timestamptz := '2026-11-01 00:00:00+00';
  v_result jsonb;
  v_count integer;
  v_charged boolean;
  v_period timestamptz;
BEGIN
  INSERT INTO auth.users (id, email)
  VALUES (v_user, 'fix03-credit-a@localhost');

  INSERT INTO public.upscale_jobs (
    id, user_id, scale, input_storage_path, input_mime_type,
    input_width, input_height, input_size_bytes
  ) VALUES (
    v_job, v_user, 2, 'fix03-local/a.png', 'image/png', 8, 8, 32
  );

  v_result := public.charge_upscale_job(v_job, v_user, v_start, v_end, 500);
  IF v_result->>'outcome' IS DISTINCT FROM 'charged' OR (v_result->>'usage_count')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL 1 first charge: %', v_result;
  END IF;

  SELECT usage_count INTO v_count
  FROM public.usage_counters
  WHERE user_id = v_user AND action = 'tool_operation' AND period_start = v_start;

  SELECT usage_charged, usage_period_start INTO v_charged, v_period
  FROM public.upscale_jobs WHERE id = v_job;

  IF v_count IS DISTINCT FROM 1 OR v_charged IS DISTINCT FROM true OR v_period IS DISTINCT FROM v_start THEN
    RAISE EXCEPTION 'FAIL 1 stored charge count=% charged=% period=%', v_count, v_charged, v_period;
  END IF;

  v_result := public.charge_upscale_job(v_job, v_user, v_start, v_end, 500);
  SELECT usage_count INTO v_count
  FROM public.usage_counters
  WHERE user_id = v_user AND action = 'tool_operation' AND period_start = v_start;

  IF v_result->>'outcome' IS DISTINCT FROM 'already_charged' OR v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL 1 duplicate charge: % count=%', v_result, v_count;
  END IF;

  RAISE NOTICE 'PASS 1 charge once';
END $$;
ROLLBACK;

-- 2. Exhausted quota does not charge the second job.
BEGIN;
DO $$
DECLARE
  v_user uuid := '01800000-0000-4000-8000-0000000000a1';
  v_first uuid := '01800000-0000-4000-8000-0000000000a2';
  v_second uuid := '01800000-0000-4000-8000-0000000000a3';
  v_start timestamptz := '2026-10-01 00:00:00+00';
  v_end timestamptz := '2026-11-01 00:00:00+00';
  v_result jsonb;
  v_count integer;
  v_second_charged boolean;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'fix03-credit-a@localhost');
  INSERT INTO public.upscale_jobs (
    id, user_id, scale, input_storage_path, input_mime_type,
    input_width, input_height, input_size_bytes
  ) VALUES
    (v_first, v_user, 2, 'fix03-local/a.png', 'image/png', 8, 8, 32),
    (v_second, v_user, 2, 'fix03-local/b.png', 'image/png', 8, 8, 32);

  PERFORM public.charge_upscale_job(v_first, v_user, v_start, v_end, 1);
  v_result := public.charge_upscale_job(v_second, v_user, v_start, v_end, 1);

  SELECT usage_charged INTO v_second_charged FROM public.upscale_jobs WHERE id = v_second;
  SELECT usage_count INTO v_count
  FROM public.usage_counters
  WHERE user_id = v_user AND action = 'tool_operation' AND period_start = v_start;

  IF v_result->>'outcome' IS DISTINCT FROM 'denied'
     OR v_second_charged
     OR v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL 2 quota: % second_charged=% count=%', v_result, v_second_charged, v_count;
  END IF;

  RAISE NOTICE 'PASS 2 quota exhausted';
END $$;
ROLLBACK;

-- 4 and 11. A failed job refunds once and the counter stays at zero.
BEGIN;
DO $$
DECLARE
  v_user uuid := '01800000-0000-4000-8000-0000000000a1';
  v_job uuid := '01800000-0000-4000-8000-0000000000a2';
  v_start timestamptz := '2026-10-01 00:00:00+00';
  v_end timestamptz := '2026-11-01 00:00:00+00';
  v_result jsonb;
  v_count integer;
  v_refunded boolean;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'fix03-credit-a@localhost');
  INSERT INTO public.upscale_jobs (
    id, user_id, scale, input_storage_path, input_mime_type,
    input_width, input_height, input_size_bytes
  ) VALUES (
    v_job, v_user, 2, 'fix03-local/a.png', 'image/png', 8, 8, 32
  );
  PERFORM public.charge_upscale_job(v_job, v_user, v_start, v_end, 500);

  UPDATE public.upscale_jobs
  SET status = 'failed', error_code = 'processing_failed', completed_at = timezone('utc', now())
  WHERE id = v_job;

  v_result := public.refund_upscale_job(v_job);
  SELECT usage_count INTO v_count
  FROM public.usage_counters
  WHERE user_id = v_user AND action = 'tool_operation' AND period_start = v_start;
  SELECT usage_refunded INTO v_refunded FROM public.upscale_jobs WHERE id = v_job;

  IF v_result->>'outcome' IS DISTINCT FROM 'refunded' OR v_count IS DISTINCT FROM 0 OR NOT v_refunded THEN
    RAISE EXCEPTION 'FAIL 4 first refund: % count=% refunded=%', v_result, v_count, v_refunded;
  END IF;

  v_result := public.refund_upscale_job(v_job);
  SELECT usage_count INTO v_count
  FROM public.usage_counters
  WHERE user_id = v_user AND action = 'tool_operation' AND period_start = v_start;

  IF v_result->>'outcome' IS DISTINCT FROM 'already_refunded' OR v_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'FAIL 4 duplicate refund: % count=%', v_result, v_count;
  END IF;

  BEGIN
    UPDATE public.usage_counters
    SET usage_count = -1
    WHERE user_id = v_user AND action = 'tool_operation' AND period_start = v_start;
    RAISE EXCEPTION 'FAIL 11 negative counter was accepted';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  SELECT usage_count INTO v_count
  FROM public.usage_counters
  WHERE user_id = v_user AND action = 'tool_operation' AND period_start = v_start;
  IF v_count IS DISTINCT FROM 0 OR v_count < 0 THEN
    RAISE EXCEPTION 'FAIL 11 counter after rejected negative write: %', v_count;
  END IF;

  RAISE NOTICE 'PASS 4 refund once';
  RAISE NOTICE 'PASS 11 counter cannot go negative';
END $$;
ROLLBACK;

-- 5. A completed job is not refunded.
BEGIN;
DO $$
DECLARE
  v_user uuid := '01800000-0000-4000-8000-0000000000a1';
  v_job uuid := '01800000-0000-4000-8000-0000000000a2';
  v_start timestamptz := '2026-10-01 00:00:00+00';
  v_end timestamptz := '2026-11-01 00:00:00+00';
  v_result jsonb;
  v_count integer;
  v_status text;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'fix03-credit-a@localhost');
  INSERT INTO public.upscale_jobs (
    id, user_id, scale, input_storage_path, input_mime_type,
    input_width, input_height, input_size_bytes
  ) VALUES (
    v_job, v_user, 2, 'fix03-local/a.png', 'image/png', 8, 8, 32
  );
  PERFORM public.charge_upscale_job(v_job, v_user, v_start, v_end, 500);
  v_result := public.complete_upscale_job(v_job, 'fix03-local/out.png', 16, 16, 'png', 64);
  IF v_result->>'outcome' IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'FAIL 5 complete: %', v_result;
  END IF;

  v_result := public.refund_upscale_job(v_job);
  IF v_result->>'outcome' IS DISTINCT FROM 'not_refundable' THEN
    RAISE EXCEPTION 'FAIL 5 refund completed: %', v_result;
  END IF;

  v_result := public.fail_upscale_job(v_job, 'late_failure', 'should not refund');
  SELECT usage_count INTO v_count
  FROM public.usage_counters
  WHERE user_id = v_user AND action = 'tool_operation' AND period_start = v_start;
  SELECT status INTO v_status FROM public.upscale_jobs WHERE id = v_job;

  IF v_result->>'outcome' IS DISTINCT FROM 'completed' OR v_count IS DISTINCT FROM 1 OR v_status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'FAIL 5 fail after complete: % count=% status=%', v_result, v_count, v_status;
  END IF;

  RAISE NOTICE 'PASS 5 completed job not refunded';
END $$;
ROLLBACK;

-- 6. A refunded job cannot become completed.
BEGIN;
DO $$
DECLARE
  v_user uuid := '01800000-0000-4000-8000-0000000000a1';
  v_job uuid := '01800000-0000-4000-8000-0000000000a2';
  v_start timestamptz := '2026-10-01 00:00:00+00';
  v_end timestamptz := '2026-11-01 00:00:00+00';
  v_result jsonb;
  v_status text;
  v_count integer;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'fix03-credit-a@localhost');
  INSERT INTO public.upscale_jobs (
    id, user_id, scale, input_storage_path, input_mime_type,
    input_width, input_height, input_size_bytes
  ) VALUES (
    v_job, v_user, 2, 'fix03-local/a.png', 'image/png', 8, 8, 32
  );
  PERFORM public.charge_upscale_job(v_job, v_user, v_start, v_end, 500);
  v_result := public.fail_upscale_job(v_job, 'processing_failed', 'failed');
  IF v_result->>'outcome' IS DISTINCT FROM 'refunded' THEN
    RAISE EXCEPTION 'FAIL 6 initial fail: %', v_result;
  END IF;

  v_result := public.complete_upscale_job(v_job, 'fix03-local/out.png', 16, 16, 'png', 64);
  IF v_result->>'outcome' IS DISTINCT FROM 'rejected' THEN
    RAISE EXCEPTION 'FAIL 6 complete function: %', v_result;
  END IF;

  BEGIN
    UPDATE public.upscale_jobs
    SET status = 'completed', stage = 'completed', progress = 100
    WHERE id = v_job;
    RAISE EXCEPTION 'FAIL 6 direct completion was allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%cannot be completed%' THEN
        RAISE;
      END IF;
  END;

  SELECT status INTO v_status FROM public.upscale_jobs WHERE id = v_job;
  SELECT usage_count INTO v_count
  FROM public.usage_counters
  WHERE user_id = v_user AND action = 'tool_operation' AND period_start = v_start;
  IF v_status IS DISTINCT FROM 'failed' OR v_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'FAIL 6 final state status=% count=%', v_status, v_count;
  END IF;

  RAISE NOTICE 'PASS 6 refunded job cannot complete';
END $$;
ROLLBACK;

-- 7. Requeue does not refund.
BEGIN;
DO $$
DECLARE
  v_user uuid := '01800000-0000-4000-8000-0000000000a1';
  v_job uuid := '01800000-0000-4000-8000-0000000000a2';
  v_start timestamptz := '2026-10-01 00:00:00+00';
  v_end timestamptz := '2026-11-01 00:00:00+00';
  v_count integer;
  v_status text;
  v_charged boolean;
  v_refunded boolean;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'fix03-credit-a@localhost');
  INSERT INTO public.upscale_jobs (
    id, user_id, scale, input_storage_path, input_mime_type,
    input_width, input_height, input_size_bytes
  ) VALUES (
    v_job, v_user, 2, 'fix03-local/a.png', 'image/png', 8, 8, 32
  );
  PERFORM public.charge_upscale_job(v_job, v_user, v_start, v_end, 500);

  UPDATE public.upscale_jobs
  SET status = 'processing',
      started_at = timezone('utc', now()) - interval '30 minutes',
      attempts = 1,
      max_attempts = 3
  WHERE id = v_job;

  PERFORM public.recover_stale_upscale_jobs(600);

  SELECT status, usage_charged, usage_refunded
  INTO v_status, v_charged, v_refunded
  FROM public.upscale_jobs WHERE id = v_job;
  SELECT usage_count INTO v_count
  FROM public.usage_counters
  WHERE user_id = v_user AND action = 'tool_operation' AND period_start = v_start;

  IF v_status IS DISTINCT FROM 'queued' OR NOT v_charged OR v_refunded OR v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL 7 requeue status=% charged=% refunded=% count=%', v_status, v_charged, v_refunded, v_count;
  END IF;

  RAISE NOTICE 'PASS 7 requeue does not refund';
END $$;
ROLLBACK;

-- 8. Final stale failure refunds.
BEGIN;
DO $$
DECLARE
  v_user uuid := '01800000-0000-4000-8000-0000000000a1';
  v_job uuid := '01800000-0000-4000-8000-0000000000a2';
  v_start timestamptz := '2026-10-01 00:00:00+00';
  v_end timestamptz := '2026-11-01 00:00:00+00';
  v_count integer;
  v_status text;
  v_refunded boolean;
  v_code text;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'fix03-credit-a@localhost');
  INSERT INTO public.upscale_jobs (
    id, user_id, scale, input_storage_path, input_mime_type,
    input_width, input_height, input_size_bytes
  ) VALUES (
    v_job, v_user, 2, 'fix03-local/a.png', 'image/png', 8, 8, 32
  );
  PERFORM public.charge_upscale_job(v_job, v_user, v_start, v_end, 500);

  UPDATE public.upscale_jobs
  SET status = 'processing',
      started_at = timezone('utc', now()) - interval '30 minutes',
      attempts = 3,
      max_attempts = 3
  WHERE id = v_job;

  PERFORM public.recover_stale_upscale_jobs(600);

  SELECT status, usage_refunded, error_code
  INTO v_status, v_refunded, v_code
  FROM public.upscale_jobs WHERE id = v_job;
  SELECT usage_count INTO v_count
  FROM public.usage_counters
  WHERE user_id = v_user AND action = 'tool_operation' AND period_start = v_start;

  IF v_status IS DISTINCT FROM 'failed' OR NOT v_refunded OR v_count IS DISTINCT FROM 0 OR v_code IS DISTINCT FROM 'processing_timeout' THEN
    RAISE EXCEPTION 'FAIL 8 stale status=% refunded=% count=% code=%', v_status, v_refunded, v_count, v_code;
  END IF;

  RAISE NOTICE 'PASS 8 final stale failure refunds';
END $$;
ROLLBACK;

-- 9. A queued job older than six hours is refunded.
BEGIN;
DO $$
DECLARE
  v_user uuid := '01800000-0000-4000-8000-0000000000a1';
  v_job uuid := '01800000-0000-4000-8000-0000000000a2';
  v_start timestamptz := '2026-10-01 00:00:00+00';
  v_end timestamptz := '2026-11-01 00:00:00+00';
  v_count integer;
  v_status text;
  v_refunded boolean;
  v_code text;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'fix03-credit-a@localhost');
  INSERT INTO public.upscale_jobs (
    id, user_id, scale, input_storage_path, input_mime_type,
    input_width, input_height, input_size_bytes, created_at
  ) VALUES (
    v_job, v_user, 2, 'fix03-local/a.png', 'image/png', 8, 8, 32,
    timezone('utc', now()) - interval '7 hours'
  );
  PERFORM public.charge_upscale_job(v_job, v_user, v_start, v_end, 500);
  PERFORM public.recover_stale_upscale_jobs(600);

  SELECT status, usage_refunded, error_code
  INTO v_status, v_refunded, v_code
  FROM public.upscale_jobs WHERE id = v_job;
  SELECT usage_count INTO v_count
  FROM public.usage_counters
  WHERE user_id = v_user AND action = 'tool_operation' AND period_start = v_start;

  IF v_status IS DISTINCT FROM 'failed' OR NOT v_refunded OR v_count IS DISTINCT FROM 0 OR v_code IS DISTINCT FROM 'queued_abandoned' THEN
    RAISE EXCEPTION 'FAIL 9 abandoned status=% refunded=% count=% code=%', v_status, v_refunded, v_count, v_code;
  END IF;

  RAISE NOTICE 'PASS 9 abandoned queued job refunds';
END $$;
ROLLBACK;

-- 10. A freshly queued job survives recovery.
BEGIN;
DO $$
DECLARE
  v_user uuid := '01800000-0000-4000-8000-0000000000a1';
  v_job uuid := '01800000-0000-4000-8000-0000000000a2';
  v_start timestamptz := '2026-10-01 00:00:00+00';
  v_end timestamptz := '2026-11-01 00:00:00+00';
  v_count integer;
  v_status text;
  v_charged boolean;
  v_refunded boolean;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'fix03-credit-a@localhost');
  INSERT INTO public.upscale_jobs (
    id, user_id, scale, input_storage_path, input_mime_type,
    input_width, input_height, input_size_bytes
  ) VALUES (
    v_job, v_user, 2, 'fix03-local/a.png', 'image/png', 8, 8, 32
  );
  PERFORM public.charge_upscale_job(v_job, v_user, v_start, v_end, 500);
  PERFORM public.recover_stale_upscale_jobs(600);

  SELECT status, usage_charged, usage_refunded
  INTO v_status, v_charged, v_refunded
  FROM public.upscale_jobs WHERE id = v_job;
  SELECT usage_count INTO v_count
  FROM public.usage_counters
  WHERE user_id = v_user AND action = 'tool_operation' AND period_start = v_start;

  IF v_status IS DISTINCT FROM 'queued' OR NOT v_charged OR v_refunded OR v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL 10 fresh queue status=% charged=% refunded=% count=%', v_status, v_charged, v_refunded, v_count;
  END IF;

  RAISE NOTICE 'PASS 10 fresh queued job kept';
END $$;
ROLLBACK;

-- 12. anon and authenticated cannot execute the credit functions.
-- service_role can charge.
BEGIN;
DO $$
DECLARE
  v_user uuid := '01800000-0000-4000-8000-0000000000a1';
  v_job uuid := '01800000-0000-4000-8000-0000000000a2';
  v_start timestamptz := '2026-10-01 00:00:00+00';
  v_end timestamptz := '2026-11-01 00:00:00+00';
  v_result jsonb;
  v_ignored integer;
  v_role text;
  v_call text;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    FOREACH v_call IN ARRAY ARRAY[
      'SELECT public.charge_upscale_job(NULL, NULL, NULL, NULL, 1)',
      'SELECT public.refund_upscale_job(NULL)',
      'SELECT public.fail_upscale_job(NULL, NULL, NULL)',
      'SELECT public.complete_upscale_job(NULL, NULL, NULL, NULL, NULL, NULL)',
      'SELECT public.recover_stale_upscale_jobs(600)',
      'SELECT public.close_uncharged_upscale_job(NULL, NULL, NULL)'
    ]
    LOOP
      BEGIN
        EXECUTE format('SET LOCAL ROLE %I', v_role);
        EXECUTE 'SELECT 1 FROM (' || v_call || ') AS denied(result)' INTO v_ignored;
        RAISE EXCEPTION 'FAIL 12 % executed %', v_role, v_call;
      EXCEPTION
        WHEN insufficient_privilege THEN
          NULL;
      END;
      RESET ROLE;
    END LOOP;
  END LOOP;

  INSERT INTO auth.users (id, email) VALUES (v_user, 'fix03-credit-a@localhost');
  INSERT INTO public.upscale_jobs (
    id, user_id, scale, input_storage_path, input_mime_type,
    input_width, input_height, input_size_bytes
  ) VALUES (
    v_job, v_user, 2, 'fix03-local/a.png', 'image/png', 8, 8, 32
  );

  BEGIN
    SET LOCAL ROLE service_role;
    v_result := public.charge_upscale_job(v_job, v_user, v_start, v_end, 500);
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE EXCEPTION 'FAIL 12 service_role cannot charge';
  END;
  RESET ROLE;

  IF v_result->>'outcome' IS DISTINCT FROM 'charged' THEN
    RAISE EXCEPTION 'FAIL 12 service_role result: %', v_result;
  END IF;

  RAISE NOTICE 'PASS 12 role privileges';
END $$;
ROLLBACK;

-- 13. A failed charge and a rolled-back charge leave no partial counter.
BEGIN;
DO $$
DECLARE
  v_user uuid := '01800000-0000-4000-8000-0000000000a1';
  v_job uuid := '01800000-0000-4000-8000-0000000000a2';
  v_start timestamptz := '2026-10-01 00:00:00+00';
  v_charged boolean;
  v_counters integer;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'fix03-credit-a@localhost');
  INSERT INTO public.upscale_jobs (
    id, user_id, scale, input_storage_path, input_mime_type,
    input_width, input_height, input_size_bytes
  ) VALUES (
    v_job, v_user, 2, 'fix03-local/a.png', 'image/png', 8, 8, 32
  );

  BEGIN
    PERFORM public.charge_upscale_job(v_job, v_user, v_start, v_start, 500);
    RAISE EXCEPTION 'FAIL 13 invalid period was accepted';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%period is invalid%' THEN
        RAISE;
      END IF;
  END;

  SELECT usage_charged INTO v_charged FROM public.upscale_jobs WHERE id = v_job;
  SELECT count(*) INTO v_counters FROM public.usage_counters WHERE user_id = v_user;
  IF v_charged OR v_counters IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'FAIL 13 invalid charge left charged=% counters=%', v_charged, v_counters;
  END IF;

  PERFORM public.charge_upscale_job(v_job, v_user, v_start, v_start + interval '31 days', 500);
  SELECT count(*) INTO v_counters
  FROM public.usage_counters
  WHERE user_id = v_user AND usage_count = 1;
  IF v_counters IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL 13 successful charge missing counter';
  END IF;

  RAISE NOTICE 'PASS 13 failed charge leaves no partial state inside the function';
END $$;
ROLLBACK;

DO $$
DECLARE
  v_users integer;
  v_jobs integer;
  v_counters integer;
BEGIN
  SELECT count(*) INTO v_users FROM auth.users WHERE id = '01800000-0000-4000-8000-0000000000a1';
  SELECT count(*) INTO v_jobs FROM public.upscale_jobs WHERE user_id = '01800000-0000-4000-8000-0000000000a1';
  SELECT count(*) INTO v_counters FROM public.usage_counters WHERE user_id = '01800000-0000-4000-8000-0000000000a1';
  IF v_users <> 0 OR v_jobs <> 0 OR v_counters <> 0 THEN
    RAISE EXCEPTION 'FAIL cleanup rollback users=% jobs=% counters=%', v_users, v_jobs, v_counters;
  END IF;
  RAISE NOTICE 'PASS rollback cleanup';
END $$;
