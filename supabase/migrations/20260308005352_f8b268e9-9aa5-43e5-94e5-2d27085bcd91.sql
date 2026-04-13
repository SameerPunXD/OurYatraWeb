
-- Allow riders to cancel their own pending rides
CREATE POLICY "Riders can cancel own pending rides"
ON public.rides FOR UPDATE TO authenticated
USING (auth.uid() = rider_id AND status = 'pending');

-- Allow senders to cancel their own pending parcels
CREATE POLICY "Senders can cancel own pending parcels"
ON public.parcels FOR UPDATE TO authenticated
USING (auth.uid() = sender_id AND status = 'pending');

-- Allow customers to cancel their own pending food orders
CREATE POLICY "Customers can cancel own pending orders"
ON public.food_orders FOR UPDATE TO authenticated
USING (auth.uid() = customer_id AND status = 'pending');
