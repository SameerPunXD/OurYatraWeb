CREATE OR REPLACE FUNCTION public.is_ride_owned_by_user(
  p_ride_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rides AS r
    WHERE r.id = p_ride_id
      AND r.rider_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_ride_owned_by_user(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_driver_targeted_for_ride(
  p_ride_id uuid,
  p_driver_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ride_driver_candidates AS c
    WHERE c.ride_id = p_ride_id
      AND c.driver_id = p_driver_id
      AND c.status = 'active'
      AND (c.expires_at IS NULL OR c.expires_at > now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_driver_targeted_for_ride(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Riders can view own ride candidates" ON public.ride_driver_candidates;
CREATE POLICY "Riders can view own ride candidates"
ON public.ride_driver_candidates
FOR SELECT
TO authenticated
USING (
  public.is_ride_owned_by_user(ride_driver_candidates.ride_id, auth.uid())
);

DROP POLICY IF EXISTS "Drivers can view targeted pending rides" ON public.rides;
CREATE POLICY "Drivers can view targeted pending rides"
ON public.rides
FOR SELECT
TO authenticated
USING (
  status = 'pending'::ride_status
  AND has_role(auth.uid(), 'driver'::app_role)
  AND public.is_driver_targeted_for_ride(rides.id, auth.uid())
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
          AND public.is_driver_targeted_for_ride(r.id, auth.uid())
        )
      )
  )
);
