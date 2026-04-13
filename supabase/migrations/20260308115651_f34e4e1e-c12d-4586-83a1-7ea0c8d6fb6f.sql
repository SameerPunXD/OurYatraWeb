
-- Add missing columns to parcels
ALTER TABLE public.parcels
ADD COLUMN IF NOT EXISTS delivery_otp text,
ADD COLUMN IF NOT EXISTS package_type text DEFAULT 'small_parcel',
ADD COLUMN IF NOT EXISTS otp_verified_at timestamptz;

-- Add missing enum values to parcel_status
ALTER TYPE public.parcel_status ADD VALUE IF NOT EXISTS 'driver_assigned';
ALTER TYPE public.parcel_status ADD VALUE IF NOT EXISTS 'driver_arriving';
ALTER TYPE public.parcel_status ADD VALUE IF NOT EXISTS 'arrived_destination';
ALTER TYPE public.parcel_status ADD VALUE IF NOT EXISTS 'otp_verified';

-- Add missing column to food_orders
ALTER TABLE public.food_orders
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cash';
