ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS h3_r9 text;

CREATE INDEX IF NOT EXISTS driver_profiles_h3_r9_idx
  ON public.driver_profiles (h3_r9);

CREATE INDEX IF NOT EXISTS driver_profiles_online_h3_last_seen_idx
  ON public.driver_profiles (h3_r9, last_seen_at DESC)
  WHERE is_online = true;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS candidate_driver_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS rides_candidate_driver_ids_gin_idx
  ON public.rides
  USING gin (candidate_driver_ids);

DROP POLICY IF EXISTS "Drivers can view pending rides" ON public.rides;
CREATE POLICY "Drivers can view targeted pending rides"
ON public.rides
FOR SELECT
TO authenticated
USING (
  status = 'pending'::ride_status
  AND has_role(auth.uid(), 'driver'::app_role)
  AND auth.uid() = ANY(candidate_driver_ids)
);

DROP POLICY IF EXISTS "Drivers can update assigned rides" ON public.rides;
CREATE POLICY "Drivers can update targeted or assigned rides"
ON public.rides
FOR UPDATE
TO authenticated
USING (
  auth.uid() = driver_id
  OR (
    status = 'pending'::ride_status
    AND has_role(auth.uid(), 'driver'::app_role)
    AND auth.uid() = ANY(candidate_driver_ids)
  )
);

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
      OR dp.service_mode = 'all'
      OR dp.service_mode = p_service_mode
    )
  ORDER BY dp.last_seen_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;

GRANT EXECUTE ON FUNCTION public.match_nearby_drivers(text[], timestamptz, text, integer) TO authenticated;
