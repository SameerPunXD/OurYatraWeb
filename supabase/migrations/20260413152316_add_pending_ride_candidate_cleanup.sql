CREATE OR REPLACE FUNCTION public.remove_driver_from_pending_rides()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid := auth.uid();
  v_rows integer := 0;
BEGIN
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.rides
  SET candidate_driver_ids = array_remove(candidate_driver_ids, v_driver_id)
  WHERE status = 'pending'::ride_status
    AND v_driver_id = ANY(candidate_driver_ids);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_driver_from_pending_rides() TO authenticated;

CREATE OR REPLACE FUNCTION public.prune_stale_pending_ride_candidates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer := 0;
BEGIN
  UPDATE public.rides AS r
  SET candidate_driver_ids = COALESCE((
    SELECT array_agg(candidate_id)
    FROM unnest(r.candidate_driver_ids) AS candidate_id
    INNER JOIN public.driver_profiles AS dp
      ON dp.id = candidate_id
    INNER JOIN public.profiles AS p
      ON p.id = candidate_id
    WHERE dp.is_online = true
      AND dp.last_seen_at IS NOT NULL
      AND dp.last_seen_at >= (now() - interval '10 seconds')
      AND p.account_status = 'approved'::account_status
      AND COALESCE(dp.service_mode, 'all') IN ('all', 'both', 'ride')
  ), ARRAY[]::uuid[])
  WHERE r.status = 'pending'::ride_status
    AND COALESCE(array_length(r.candidate_driver_ids, 1), 0) > 0
    AND EXISTS (
      SELECT 1
      FROM unnest(r.candidate_driver_ids) AS candidate_id
      LEFT JOIN public.driver_profiles AS dp
        ON dp.id = candidate_id
      LEFT JOIN public.profiles AS p
        ON p.id = candidate_id
      WHERE dp.id IS NULL
        OR dp.is_online IS DISTINCT FROM true
        OR dp.last_seen_at IS NULL
        OR dp.last_seen_at < (now() - interval '10 seconds')
        OR p.id IS NULL
        OR p.account_status <> 'approved'::account_status
        OR COALESCE(dp.service_mode, 'all') NOT IN ('all', 'both', 'ride')
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_driver_pending_rides(p_h3_cells text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid := auth.uid();
  v_driver_vehicle_type text;
  v_driver_service_mode text;
  v_added integer := 0;
  v_removed integer := 0;
  v_pruned integer := 0;
BEGIN
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_pruned := public.prune_stale_pending_ride_candidates();

  IF COALESCE(array_length(p_h3_cells, 1), 0) = 0 THEN
    v_removed := public.remove_driver_from_pending_rides();
    RETURN jsonb_build_object('added', 0, 'removed', v_removed, 'pruned', v_pruned);
  END IF;

  SELECT
    lower(COALESCE(dp.vehicle_type, '')),
    COALESCE(dp.service_mode, 'all')
  INTO v_driver_vehicle_type, v_driver_service_mode
  FROM public.driver_profiles AS dp
  INNER JOIN public.profiles AS p
    ON p.id = dp.id
  WHERE dp.id = v_driver_id
    AND dp.is_online = true
    AND dp.last_seen_at IS NOT NULL
    AND dp.last_seen_at >= (now() - interval '10 seconds')
    AND p.account_status = 'approved'::account_status;

  IF NOT FOUND THEN
    v_removed := public.remove_driver_from_pending_rides();
    RETURN jsonb_build_object('added', 0, 'removed', v_removed, 'pruned', v_pruned);
  END IF;

  IF v_driver_service_mode NOT IN ('all', 'both', 'ride') THEN
    v_removed := public.remove_driver_from_pending_rides();
    RETURN jsonb_build_object('added', 0, 'removed', v_removed, 'pruned', v_pruned);
  END IF;

  UPDATE public.rides AS r
  SET candidate_driver_ids = array_remove(r.candidate_driver_ids, v_driver_id)
  WHERE r.status = 'pending'::ride_status
    AND v_driver_id = ANY(r.candidate_driver_ids)
    AND (
      r.pickup_h3_r9 IS NULL
      OR NOT (r.pickup_h3_r9 = ANY(p_h3_cells))
      OR CASE lower(COALESCE(r.vehicle_type, ''))
        WHEN 'bike' THEN NOT (v_driver_vehicle_type IN ('bike', 'scooter'))
        WHEN 'auto' THEN NOT (v_driver_vehicle_type = 'auto')
        WHEN 'taxi' THEN NOT (v_driver_vehicle_type IN ('car', 'van'))
        ELSE false
      END
    );

  GET DIAGNOSTICS v_removed = ROW_COUNT;

  UPDATE public.rides AS r
  SET candidate_driver_ids = array_append(r.candidate_driver_ids, v_driver_id)
  WHERE r.status = 'pending'::ride_status
    AND r.driver_id IS NULL
    AND r.pickup_h3_r9 = ANY(p_h3_cells)
    AND NOT (v_driver_id = ANY(r.candidate_driver_ids))
    AND CASE lower(COALESCE(r.vehicle_type, ''))
      WHEN 'bike' THEN v_driver_vehicle_type IN ('bike', 'scooter')
      WHEN 'auto' THEN v_driver_vehicle_type = 'auto'
      WHEN 'taxi' THEN v_driver_vehicle_type IN ('car', 'van')
      ELSE true
    END;

  GET DIAGNOSTICS v_added = ROW_COUNT;

  RETURN jsonb_build_object('added', v_added, 'removed', v_removed, 'pruned', v_pruned);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_driver_pending_rides(text[]) TO authenticated;
