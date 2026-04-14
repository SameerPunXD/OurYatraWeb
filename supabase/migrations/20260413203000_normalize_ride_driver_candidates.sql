CREATE TABLE IF NOT EXISTS public.ride_driver_candidates (
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'expired', 'removed')),
  distance_km double precision,
  matched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ride_id, driver_id)
);

ALTER TABLE public.ride_driver_candidates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ride_driver_candidates_active_driver_idx
  ON public.ride_driver_candidates (driver_id, matched_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS ride_driver_candidates_active_ride_idx
  ON public.ride_driver_candidates (ride_id, matched_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS ride_driver_candidates_status_expires_idx
  ON public.ride_driver_candidates (status, expires_at);

DROP POLICY IF EXISTS "Drivers can view own ride candidates" ON public.ride_driver_candidates;
CREATE POLICY "Drivers can view own ride candidates"
ON public.ride_driver_candidates
FOR SELECT
TO authenticated
USING (
  driver_id = auth.uid()
  AND has_role(auth.uid(), 'driver'::app_role)
);

DROP POLICY IF EXISTS "Riders can view own ride candidates" ON public.ride_driver_candidates;
CREATE POLICY "Riders can view own ride candidates"
ON public.ride_driver_candidates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rides AS r
    WHERE r.id = ride_driver_candidates.ride_id
      AND r.rider_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can view all ride candidates" ON public.ride_driver_candidates;
CREATE POLICY "Admins can view all ride candidates"
ON public.ride_driver_candidates
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Admins can manage ride candidates" ON public.ride_driver_candidates;
CREATE POLICY "Admins can manage ride candidates"
ON public.ride_driver_candidates
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

INSERT INTO public.ride_driver_candidates (
  ride_id,
  driver_id,
  status,
  matched_at,
  updated_at
)
SELECT
  r.id,
  candidate_id,
  CASE
    WHEN r.status = 'accepted'::ride_status AND r.driver_id = candidate_id THEN 'claimed'
    WHEN r.status = 'pending'::ride_status THEN 'active'
    ELSE 'removed'
  END,
  r.created_at,
  now()
FROM public.rides AS r
CROSS JOIN LATERAL unnest(r.candidate_driver_ids) AS candidate(candidate_id)
ON CONFLICT (ride_id, driver_id) DO UPDATE
SET
  status = EXCLUDED.status,
  matched_at = LEAST(public.ride_driver_candidates.matched_at, EXCLUDED.matched_at),
  updated_at = now();

DROP POLICY IF EXISTS "Drivers can view targeted pending rides" ON public.rides;
CREATE POLICY "Drivers can view targeted pending rides"
ON public.rides
FOR SELECT
TO authenticated
USING (
  status = 'pending'::ride_status
  AND has_role(auth.uid(), 'driver'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.ride_driver_candidates AS c
    WHERE c.ride_id = rides.id
      AND c.driver_id = auth.uid()
      AND c.status = 'active'
      AND (c.expires_at IS NULL OR c.expires_at > now())
  )
);

DROP POLICY IF EXISTS "Drivers can view rider profiles for visible rides" ON public.profiles;
CREATE POLICY "Drivers can view rider profiles for visible rides"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'driver'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.rides AS r
    WHERE r.rider_id = profiles.id
      AND (
        r.driver_id = auth.uid()
        OR (
          r.status = 'pending'::public.ride_status
          AND EXISTS (
            SELECT 1
            FROM public.ride_driver_candidates AS c
            WHERE c.ride_id = r.id
              AND c.driver_id = auth.uid()
              AND c.status = 'active'
              AND (c.expires_at IS NULL OR c.expires_at > now())
          )
        )
      )
  )
);

CREATE OR REPLACE FUNCTION public.finalize_ride_driver_candidates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'pending'::ride_status THEN
    UPDATE public.ride_driver_candidates AS c
    SET
      status = CASE
        WHEN NEW.driver_id IS NOT NULL AND c.driver_id = NEW.driver_id THEN 'claimed'
        ELSE 'removed'
      END,
      expires_at = CASE
        WHEN NEW.driver_id IS NOT NULL AND c.driver_id = NEW.driver_id THEN c.expires_at
        ELSE COALESCE(c.expires_at, now())
      END,
      updated_at = now()
    WHERE c.ride_id = NEW.id
      AND c.status = 'active';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finalize_ride_driver_candidates_after_ride_change ON public.rides;
CREATE TRIGGER finalize_ride_driver_candidates_after_ride_change
AFTER UPDATE OF status, driver_id ON public.rides
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.driver_id IS DISTINCT FROM NEW.driver_id)
EXECUTE FUNCTION public.finalize_ride_driver_candidates();

CREATE OR REPLACE FUNCTION public.replace_ride_driver_candidates(
  p_ride_id uuid,
  p_driver_ids uuid[]
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
  v_removed integer := 0;
  v_upserted integer := 0;
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
      'removed', 0,
      'upserted', 0,
      'active_count', 0,
      'skipped', true
    );
  END IF;

  UPDATE public.ride_driver_candidates AS c
  SET
    status = 'removed',
    expires_at = COALESCE(c.expires_at, now()),
    updated_at = now()
  WHERE c.ride_id = p_ride_id
    AND c.status = 'active'
    AND NOT (c.driver_id = ANY(v_driver_ids));

  GET DIAGNOSTICS v_removed = ROW_COUNT;

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
    NULL,
    now()
  FROM (
    SELECT DISTINCT candidate_driver_id
    FROM unnest(v_driver_ids) AS candidate(candidate_driver_id)
    WHERE candidate_driver_id IS NOT NULL
  ) AS normalized_candidates
  ON CONFLICT (ride_id, driver_id) DO UPDATE
  SET
    status = 'active',
    expires_at = NULL,
    updated_at = now(),
    matched_at = CASE
      WHEN public.ride_driver_candidates.status = 'active'
        AND public.ride_driver_candidates.expires_at IS NULL
      THEN public.ride_driver_candidates.matched_at
      ELSE now()
    END
  WHERE public.ride_driver_candidates.status <> 'active'
    OR public.ride_driver_candidates.expires_at IS NOT NULL;

  GET DIAGNOSTICS v_upserted = ROW_COUNT;

  SELECT COUNT(*)
  INTO v_active_count
  FROM public.ride_driver_candidates AS c
  WHERE c.ride_id = p_ride_id
    AND c.status = 'active'
    AND (c.expires_at IS NULL OR c.expires_at > now());

  RETURN jsonb_build_object(
    'removed', v_removed,
    'upserted', v_upserted,
    'active_count', v_active_count,
    'skipped', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_ride_driver_candidates(uuid, uuid[]) TO authenticated;

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

  UPDATE public.ride_driver_candidates AS c
  SET
    status = 'removed',
    expires_at = COALESCE(c.expires_at, now()),
    updated_at = now()
  FROM public.rides AS r
  WHERE c.ride_id = r.id
    AND c.driver_id = v_driver_id
    AND c.status = 'active'
    AND r.status = 'pending'::ride_status;

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
  UPDATE public.ride_driver_candidates AS c
  SET
    status = CASE
      WHEN r.status = 'accepted'::ride_status AND r.driver_id = c.driver_id THEN 'claimed'
      WHEN r.status = 'pending'::ride_status THEN 'expired'
      ELSE 'removed'
    END,
    expires_at = CASE
      WHEN r.status = 'accepted'::ride_status AND r.driver_id = c.driver_id THEN c.expires_at
      ELSE COALESCE(c.expires_at, now())
    END,
    updated_at = now()
  FROM public.rides AS r
  WHERE c.ride_id = r.id
    AND c.status = 'active'
    AND (
      r.status <> 'pending'::ride_status
      OR NOT EXISTS (
        SELECT 1
        FROM public.driver_profiles AS dp
        INNER JOIN public.profiles AS p
          ON p.id = dp.id
        WHERE dp.id = c.driver_id
          AND dp.is_online = true
          AND dp.last_seen_at IS NOT NULL
          AND dp.last_seen_at >= (now() - interval '10 seconds')
          AND p.account_status = 'approved'::account_status
          AND COALESCE(dp.service_mode, 'all') IN ('all', 'both', 'ride')
          AND CASE lower(COALESCE(r.vehicle_type, ''))
            WHEN 'bike' THEN lower(COALESCE(dp.vehicle_type, '')) IN ('bike', 'scooter')
            WHEN 'auto' THEN lower(COALESCE(dp.vehicle_type, '')) = 'auto'
            WHEN 'taxi' THEN lower(COALESCE(dp.vehicle_type, '')) IN ('car', 'van')
            ELSE true
          END
      )
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

  UPDATE public.ride_driver_candidates AS c
  SET
    status = 'removed',
    expires_at = COALESCE(c.expires_at, now()),
    updated_at = now()
  FROM public.rides AS r
  WHERE c.ride_id = r.id
    AND c.driver_id = v_driver_id
    AND c.status = 'active'
    AND r.status = 'pending'::ride_status
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
    r.id,
    v_driver_id,
    'active',
    NULL,
    now(),
    NULL,
    now()
  FROM public.rides AS r
  WHERE r.status = 'pending'::ride_status
    AND r.driver_id IS NULL
    AND r.pickup_h3_r9 = ANY(p_h3_cells)
    AND CASE lower(COALESCE(r.vehicle_type, ''))
      WHEN 'bike' THEN v_driver_vehicle_type IN ('bike', 'scooter')
      WHEN 'auto' THEN v_driver_vehicle_type = 'auto'
      WHEN 'taxi' THEN v_driver_vehicle_type IN ('car', 'van')
      ELSE true
    END
  ON CONFLICT (ride_id, driver_id) DO UPDATE
  SET
    status = 'active',
    expires_at = NULL,
    updated_at = now(),
    matched_at = CASE
      WHEN public.ride_driver_candidates.status = 'active'
        AND public.ride_driver_candidates.expires_at IS NULL
      THEN public.ride_driver_candidates.matched_at
      ELSE now()
    END
  WHERE public.ride_driver_candidates.status <> 'active'
    OR public.ride_driver_candidates.expires_at IS NOT NULL;

  GET DIAGNOSTICS v_added = ROW_COUNT;

  RETURN jsonb_build_object('added', v_added, 'removed', v_removed, 'pruned', v_pruned);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_driver_pending_rides(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_driver_for_pending_rides(p_h3_cells text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sync_result jsonb;
BEGIN
  v_sync_result := public.sync_driver_pending_rides(p_h3_cells);
  RETURN COALESCE((v_sync_result ->> 'added')::integer, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_driver_for_pending_rides(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_ride(p_ride_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid := auth.uid();
  v_ride public.rides%ROWTYPE;
BEGIN
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.has_role(v_driver_id, 'driver'::app_role) THEN
    RAISE EXCEPTION 'Only drivers can claim rides';
  END IF;

  PERFORM 1
  FROM public.driver_profiles AS dp
  INNER JOIN public.profiles AS p
    ON p.id = dp.id
  WHERE dp.id = v_driver_id
    AND dp.is_online = true
    AND p.account_status = 'approved'::account_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver must be online and approved';
  END IF;

  UPDATE public.rides
  SET
    driver_id = v_driver_id,
    status = 'accepted'::ride_status
  WHERE id = p_ride_id
    AND status = 'pending'::ride_status
    AND driver_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.ride_driver_candidates AS c
      WHERE c.ride_id = p_ride_id
        AND c.driver_id = v_driver_id
        AND c.status = 'active'
        AND (c.expires_at IS NULL OR c.expires_at > now())
    )
  RETURNING * INTO v_ride;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride is no longer available';
  END IF;

  RETURN jsonb_build_object(
    'id', v_ride.id,
    'driver_id', v_ride.driver_id,
    'rider_id', v_ride.rider_id,
    'status', v_ride.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_ride(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ride_driver_candidates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_driver_candidates;
  END IF;
END;
$$;
