ALTER TABLE public.garage_orders
ADD COLUMN IF NOT EXISTS driver_lat double precision,
ADD COLUMN IF NOT EXISTS driver_lng double precision,
ADD COLUMN IF NOT EXISTS driver_address text,
ADD COLUMN IF NOT EXISTS mechanic_id uuid,
ADD COLUMN IF NOT EXISTS mechanic_lat double precision,
ADD COLUMN IF NOT EXISTS mechanic_lng double precision,
ADD COLUMN IF NOT EXISTS mechanic_updated_at timestamptz;
