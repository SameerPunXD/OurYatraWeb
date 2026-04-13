-- Manual QR-based subscription payment flow

ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS screenshot_url text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS review_note text;

-- Admin can review/update payment requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_payments'
      AND policyname = 'Admins can view all subscription payments'
  ) THEN
    CREATE POLICY "Admins can view all subscription payments"
      ON public.subscription_payments
      FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_payments'
      AND policyname = 'Admins can update subscription payments'
  ) THEN
    CREATE POLICY "Admins can update subscription payments"
      ON public.subscription_payments
      FOR UPDATE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

-- Admin can manage subscriptions (needed when approving payments)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscriptions'
      AND policyname = 'Admins can manage subscriptions'
  ) THEN
    CREATE POLICY "Admins can manage subscriptions"
      ON public.subscriptions
      FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

-- Storage bucket for uploaded payment screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Users can upload into their own folder: <user_id>/...
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload own payment proofs'
  ) THEN
    CREATE POLICY "Users can upload own payment proofs"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'payment-proofs'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can view own payment proofs'
  ) THEN
    CREATE POLICY "Users can view own payment proofs"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'payment-proofs'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins can view all payment proofs'
  ) THEN
    CREATE POLICY "Admins can view all payment proofs"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'payment-proofs'
        AND public.has_role(auth.uid(), 'admin'::public.app_role)
      );
  END IF;
END $$;
