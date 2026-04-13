-- Allow drivers to view rider/sender basic profiles for rides/parcels they can act on

CREATE POLICY "Drivers can view rider profiles for visible rides"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'driver'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.rides r
    WHERE r.rider_id = profiles.id
      AND (r.driver_id = auth.uid() OR r.status = 'pending'::public.ride_status)
  )
);

CREATE POLICY "Drivers can view sender profiles for visible parcels"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'driver'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.parcels p
    WHERE p.sender_id = profiles.id
      AND (p.driver_id = auth.uid() OR p.status = 'pending'::public.parcel_status)
  )
);
