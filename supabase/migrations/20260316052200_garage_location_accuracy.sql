ALTER TABLE public.garage_orders
ADD COLUMN IF NOT EXISTS location_accuracy text DEFAULT 'exact';