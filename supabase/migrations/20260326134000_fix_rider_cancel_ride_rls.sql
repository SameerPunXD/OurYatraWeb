drop policy if exists "Riders can cancel own pending rides" on public.rides;

create policy "Riders can cancel own pending rides"
on public.rides
for update
to authenticated
using (
  auth.uid() = rider_id
  and status = 'pending'::ride_status
)
with check (
  auth.uid() = rider_id
  and status = 'cancelled'::ride_status
);
