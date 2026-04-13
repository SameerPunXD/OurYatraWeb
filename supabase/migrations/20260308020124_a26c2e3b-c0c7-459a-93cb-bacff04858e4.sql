ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS scheduled_at timestamptz DEFAULT NULL;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS cancellation_reason text DEFAULT NULL;