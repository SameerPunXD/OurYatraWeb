-- Add 'on_the_way' to food_order_status enum
ALTER TYPE food_order_status ADD VALUE 'on_the_way' AFTER 'picked_up';

-- Allow drivers to view ready (unassigned) food orders
CREATE POLICY "Drivers can view ready food orders"
ON food_orders FOR SELECT TO authenticated
USING (status = 'ready' AND driver_id IS NULL AND has_role(auth.uid(), 'driver'));

-- Allow drivers to claim unassigned ready food orders
CREATE POLICY "Drivers can accept ready food orders"
ON food_orders FOR UPDATE TO authenticated
USING (status = 'ready' AND driver_id IS NULL AND has_role(auth.uid(), 'driver'));