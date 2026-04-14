CREATE OR REPLACE FUNCTION public.dispatch_ride_driver_candidates(
  p_ride_id uuid,
  p_driver_ids uuid[],
  p_offer_window_seconds integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_is_admin boolean := false;
  v_ride_rider_id uuid;
  v_ride_status ride_status;
  v_driver_ids uuid[] := COALESCE(p_driver_ids, ARRAY[]::uuid[]);
  v_offer_window interval := make_interval(secs => GREATEST(COALESCE(p_offer_window_seconds, 5), 1));
  v_expired integer := 0;
  v_dispatched integer := 0;
  v_active_count integer := 0;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT
    r.rider_id,
    r.status
  INTO v_ride_rider_id, v_ride_status
  FROM public.rides AS r
  WHERE r.id = p_ride_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride not found';
  END IF;

  v_is_admin := public.has_role(v_actor_id, 'admin'::app_role);
  IF v_ride_rider_id <> v_actor_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_ride_status <> 'pending'::ride_status THEN
    RETURN jsonb_build_object(
      'expired', 0,
      'dispatched', 0,
      'active_count', 0,
      'skipped', true
    );
  END IF;

  UPDATE public.ride_driver_candidates AS c
  SET
    status = 'expired',
    expires_at = COALESCE(c.expires_at, now()),
    updated_at = now()
  WHERE c.ride_id = p_ride_id
    AND c.status = 'active'
    AND NOT (c.driver_id = ANY(v_driver_ids));

  GET DIAGNOSTICS v_expired = ROW_COUNT;

  INSERT INTO public.ride_driver_candidates (
    ride_id,
    driver_id,
    status,
    distance_km,
    matched_at,
    expires_at,
    updated_at
  )
  SELECT
    p_ride_id,
    candidate_driver_id,
    'active',
    NULL,
    now(),
    now() + v_offer_window,
    now()
  FROM (
    SELECT DISTINCT candidate_driver_id
    FROM unnest(v_driver_ids) AS candidate(candidate_driver_id)
    WHERE candidate_driver_id IS NOT NULL
  ) AS normalized_candidates
  ON CONFLICT (ride_id, driver_id) DO UPDATE
  SET
    status = 'active',
    expires_at = now() + v_offer_window,
    updated_at = now(),
    matched_at = now()
  WHERE public.ride_driver_candidates.status <> 'claimed';

  GET DIAGNOSTICS v_dispatched = ROW_COUNT;

  SELECT COUNT(*)
  INTO v_active_count
  FROM public.ride_driver_candidates AS c
  WHERE c.ride_id = p_ride_id
    AND c.status = 'active'
    AND (c.expires_at IS NULL OR c.expires_at > now());

  RETURN jsonb_build_object(
    'expired', v_expired,
    'dispatched', v_dispatched,
    'active_count', v_active_count,
    'skipped', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispatch_ride_driver_candidates(uuid, uuid[], integer) TO authenticated;
