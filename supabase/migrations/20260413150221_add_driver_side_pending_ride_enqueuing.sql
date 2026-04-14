UPDATE public.driver_profiles
SET service_mode = 'all'
WHERE service_mode = 'both';

ALTER TABLE public.driver_profiles
  ALTER COLUMN service_mode SET DEFAULT 'all';

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS pickup_h3_r9 text;

CREATE INDEX IF NOT EXISTS rides_pending_pickup_h3_r9_idx
  ON public.rides (pickup_h3_r9, created_at DESC)
  WHERE status = 'pending'::ride_status;

CREATE OR REPLACE FUNCTION public.match_nearby_drivers(
  p_h3_cells text[],
  p_last_seen_after timestamptz,
  p_service_mode text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  lat double precision,
  lng double precision,
  h3_r9 text,
  last_seen_at timestamptz,
  vehicle_type text,
  service_mode text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dp.id,
    dp.lat,
    dp.lng,
    dp.h3_r9,
    dp.last_seen_at,
    dp.vehicle_type,
    dp.service_mode
  FROM public.driver_profiles AS dp
  INNER JOIN public.profiles AS p
    ON p.id = dp.id
  WHERE dp.is_online = true
    AND dp.lat IS NOT NULL
    AND dp.lng IS NOT NULL
    AND dp.h3_r9 IS NOT NULL
    AND dp.last_seen_at IS NOT NULL
    AND dp.h3_r9 = ANY(p_h3_cells)
    AND dp.last_seen_at >= p_last_seen_after
    AND p.account_status = 'approved'::account_status
    AND (
      p_service_mode IS NULL
      OR dp.service_mode IN ('all', 'both')
      OR dp.service_mode = p_service_mode
    )
  ORDER BY dp.last_seen_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;

CREATE OR REPLACE FUNCTION public.enqueue_driver_for_pending_rides(p_h3_cells text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid := auth.uid();
  v_driver_vehicle_type text;
  v_driver_service_mode text;
  v_rows integer := 0;
BEGIN
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF COALESCE(array_length(p_h3_cells, 1), 0) = 0 THEN
    RETURN 0;
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
    AND p.account_status = 'approved'::account_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver must be online and approved';
  END IF;

  IF v_driver_service_mode NOT IN ('all', 'both', 'ride') THEN
    RETURN 0;
  END IF;

  UPDATE public.rides AS r
  SET candidate_driver_ids = CASE
    WHEN v_driver_id = ANY(r.candidate_driver_ids) THEN r.candidate_driver_ids
    ELSE array_append(r.candidate_driver_ids, v_driver_id)
  END
  WHERE r.status = 'pending'::ride_status
    AND r.driver_id IS NULL
    AND r.pickup_h3_r9 = ANY(p_h3_cells)
    AND CASE lower(COALESCE(r.vehicle_type, ''))
      WHEN 'bike' THEN v_driver_vehicle_type IN ('bike', 'scooter')
      WHEN 'auto' THEN v_driver_vehicle_type = 'auto'
      WHEN 'taxi' THEN v_driver_vehicle_type IN ('car', 'van')
      ELSE true
    END;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_driver_for_pending_rides(text[]) TO authenticated;
