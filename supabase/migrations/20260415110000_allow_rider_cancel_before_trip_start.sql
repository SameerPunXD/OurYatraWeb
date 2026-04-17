DROP POLICY IF EXISTS "Riders can cancel own pending rides" ON public.rides;
DROP POLICY IF EXISTS "Riders can cancel own rides before trip starts" ON public.rides;

CREATE POLICY "Riders can cancel own rides before trip starts"
ON public.rides
FOR UPDATE
TO authenticated
USING (
  auth.uid() = rider_id
  AND status IN ('pending'::ride_status, 'accepted'::ride_status)
)
WITH CHECK (
  auth.uid() = rider_id
  AND status = 'cancelled'::ride_status
);
