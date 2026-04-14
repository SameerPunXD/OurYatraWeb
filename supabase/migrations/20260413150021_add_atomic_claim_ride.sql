DROP POLICY IF EXISTS "Drivers can update targeted or assigned rides" ON public.rides;
CREATE POLICY "Drivers can update assigned rides only"
ON public.rides
FOR UPDATE
TO authenticated
USING (
  auth.uid() = driver_id
);

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
    AND v_driver_id = ANY(candidate_driver_ids)
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
