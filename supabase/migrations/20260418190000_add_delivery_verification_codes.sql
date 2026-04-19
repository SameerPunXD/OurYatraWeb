CREATE TYPE public.delivery_verification_target AS ENUM (
  'food_order',
  'parcel_ride',
  'parcel_order'
);

CREATE TABLE public.delivery_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target public.delivery_verification_target NOT NULL,
  order_id uuid NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^\d{6}$'),
  verified_at timestamptz,
  verified_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invalidated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target, order_id)
);

CREATE INDEX delivery_verification_codes_owner_idx
  ON public.delivery_verification_codes (owner_user_id, created_at DESC);

CREATE INDEX delivery_verification_codes_target_order_idx
  ON public.delivery_verification_codes (target, order_id);

ALTER TABLE public.delivery_verification_codes ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.delivery_verification_codes TO authenticated;

CREATE POLICY "Owners can view own delivery verification codes"
ON public.delivery_verification_codes
FOR SELECT
TO authenticated
USING (auth.uid() = owner_user_id);

CREATE POLICY "Admins can view all delivery verification codes"
ON public.delivery_verification_codes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_delivery_verification_codes_updated_at
BEFORE UPDATE ON public.delivery_verification_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_delivery_verification_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN lpad(((random() * 1000000)::int % 1000000)::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_delivery_verification_code(
  p_target public.delivery_verification_target,
  p_order_id uuid,
  p_owner_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_order_id IS NULL OR p_owner_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.delivery_verification_codes (
    target,
    order_id,
    owner_user_id,
    code
  )
  VALUES (
    p_target,
    p_order_id,
    p_owner_user_id,
    public.generate_delivery_verification_code()
  )
  ON CONFLICT (target, order_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.invalidate_delivery_verification_code(
  p_target public.delivery_verification_target,
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF p_order_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.delivery_verification_codes
  SET
    invalidated_at = COALESCE(invalidated_at, v_now),
    updated_at = v_now
  WHERE target = p_target
    AND order_id = p_order_id
    AND invalidated_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_verified_delivery_code(
  p_target public.delivery_verification_target,
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_code public.delivery_verification_codes%ROWTYPE;
BEGIN
  SELECT *
  INTO v_code
  FROM public.delivery_verification_codes
  WHERE target = p_target
    AND order_id = p_order_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND OR v_code.verified_at IS NULL THEN
    RAISE EXCEPTION 'Delivery verification code must be verified before completion';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_delivery_verification_codes_from_food_orders()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('delivered'::public.food_order_status, 'cancelled'::public.food_order_status) THEN
      PERFORM public.ensure_delivery_verification_code('food_order'::public.delivery_verification_target, NEW.id, NEW.customer_id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status IN ('delivered'::public.food_order_status, 'cancelled'::public.food_order_status) THEN
    PERFORM public.invalidate_delivery_verification_code('food_order'::public.delivery_verification_target, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_delivery_verification_codes_from_rides()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.ride_type, '') <> 'parcel' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('completed'::public.ride_status, 'cancelled'::public.ride_status) THEN
      PERFORM public.ensure_delivery_verification_code('parcel_ride'::public.delivery_verification_target, NEW.id, NEW.rider_id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status IN ('completed'::public.ride_status, 'cancelled'::public.ride_status) THEN
    PERFORM public.invalidate_delivery_verification_code('parcel_ride'::public.delivery_verification_target, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_delivery_verification_codes_from_parcels()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('delivered'::public.parcel_status, 'cancelled'::public.parcel_status) THEN
      PERFORM public.ensure_delivery_verification_code('parcel_order'::public.delivery_verification_target, NEW.id, NEW.sender_id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status IN ('delivered'::public.parcel_status, 'cancelled'::public.parcel_status) THEN
    PERFORM public.invalidate_delivery_verification_code('parcel_order'::public.delivery_verification_target, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_food_order_delivery_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered'::public.food_order_status
    AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.require_verified_delivery_code('food_order'::public.delivery_verification_target, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_parcel_ride_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.ride_type, '') = 'parcel'
    AND NEW.status = 'completed'::public.ride_status
    AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.require_verified_delivery_code('parcel_ride'::public.delivery_verification_target, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_parcel_order_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered'::public.parcel_status
    AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.require_verified_delivery_code('parcel_order'::public.delivery_verification_target, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_delivery_verification_food_orders
AFTER INSERT OR UPDATE ON public.food_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_delivery_verification_codes_from_food_orders();

CREATE TRIGGER sync_delivery_verification_rides
AFTER INSERT OR UPDATE ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.sync_delivery_verification_codes_from_rides();

CREATE TRIGGER sync_delivery_verification_parcels
AFTER INSERT OR UPDATE ON public.parcels
FOR EACH ROW
EXECUTE FUNCTION public.sync_delivery_verification_codes_from_parcels();

CREATE TRIGGER guard_food_order_delivery_completion
BEFORE UPDATE ON public.food_orders
FOR EACH ROW
EXECUTE FUNCTION public.guard_food_order_delivery_completion();

CREATE TRIGGER guard_parcel_ride_completion
BEFORE UPDATE ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.guard_parcel_ride_completion();

CREATE TRIGGER guard_parcel_order_completion
BEFORE UPDATE ON public.parcels
FOR EACH ROW
EXECUTE FUNCTION public.guard_parcel_order_completion();

INSERT INTO public.delivery_verification_codes (
  target,
  order_id,
  owner_user_id,
  code
)
SELECT
  'food_order'::public.delivery_verification_target,
  food_orders.id,
  food_orders.customer_id,
  public.generate_delivery_verification_code()
FROM public.food_orders
WHERE food_orders.status NOT IN ('delivered'::public.food_order_status, 'cancelled'::public.food_order_status)
ON CONFLICT (target, order_id) DO NOTHING;

INSERT INTO public.delivery_verification_codes (
  target,
  order_id,
  owner_user_id,
  code
)
SELECT
  'parcel_ride'::public.delivery_verification_target,
  rides.id,
  rides.rider_id,
  public.generate_delivery_verification_code()
FROM public.rides
WHERE COALESCE(rides.ride_type, '') = 'parcel'
  AND rides.status NOT IN ('completed'::public.ride_status, 'cancelled'::public.ride_status)
ON CONFLICT (target, order_id) DO NOTHING;

INSERT INTO public.delivery_verification_codes (
  target,
  order_id,
  owner_user_id,
  code
)
SELECT
  'parcel_order'::public.delivery_verification_target,
  parcels.id,
  parcels.sender_id,
  public.generate_delivery_verification_code()
FROM public.parcels
WHERE parcels.status NOT IN ('delivered'::public.parcel_status, 'cancelled'::public.parcel_status)
ON CONFLICT (target, order_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_delivery_completion(
  p_target public.delivery_verification_target,
  p_order_id uuid,
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_code text := regexp_replace(COALESCE(p_code, ''), '\D', '', 'g');
  v_verification public.delivery_verification_codes%ROWTYPE;
  v_food public.food_orders%ROWTYPE;
  v_ride public.rides%ROWTYPE;
  v_parcel public.parcels%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_code !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'Please enter the 6-digit verification code';
  END IF;

  IF p_target = 'food_order'::public.delivery_verification_target THEN
    SELECT *
    INTO v_food
    FROM public.food_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Food order not found';
    END IF;

    IF v_food.driver_id IS NULL OR v_food.driver_id <> v_user_id THEN
      RAISE EXCEPTION 'Only the assigned rider can verify this delivery';
    END IF;

    IF v_food.status = 'cancelled'::public.food_order_status THEN
      RAISE EXCEPTION 'This order has already been cancelled';
    END IF;

    IF v_food.status = 'delivered'::public.food_order_status THEN
      RAISE EXCEPTION 'This order has already been delivered';
    END IF;
  ELSIF p_target = 'parcel_ride'::public.delivery_verification_target THEN
    SELECT *
    INTO v_ride
    FROM public.rides
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND OR COALESCE(v_ride.ride_type, '') <> 'parcel' THEN
      RAISE EXCEPTION 'Parcel delivery not found';
    END IF;

    IF v_ride.driver_id IS NULL OR v_ride.driver_id <> v_user_id THEN
      RAISE EXCEPTION 'Only the assigned rider can verify this delivery';
    END IF;

    IF v_ride.status = 'cancelled'::public.ride_status THEN
      RAISE EXCEPTION 'This delivery has already been cancelled';
    END IF;

    IF v_ride.status = 'completed'::public.ride_status THEN
      RAISE EXCEPTION 'This delivery has already been completed';
    END IF;
  ELSIF p_target = 'parcel_order'::public.delivery_verification_target THEN
    SELECT *
    INTO v_parcel
    FROM public.parcels
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parcel order not found';
    END IF;

    IF v_parcel.driver_id IS NULL OR v_parcel.driver_id <> v_user_id THEN
      RAISE EXCEPTION 'Only the assigned driver can verify this delivery';
    END IF;

    IF v_parcel.status = 'cancelled'::public.parcel_status THEN
      RAISE EXCEPTION 'This parcel has already been cancelled';
    END IF;

    IF v_parcel.status = 'delivered'::public.parcel_status THEN
      RAISE EXCEPTION 'This parcel has already been delivered';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported delivery verification target';
  END IF;

  SELECT *
  INTO v_verification
  FROM public.delivery_verification_codes
  WHERE target = p_target
    AND order_id = p_order_id
    AND invalidated_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR v_verification.verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid or expired verification code';
  END IF;

  IF v_verification.code <> v_code THEN
    RAISE EXCEPTION 'Incorrect verification code';
  END IF;

  UPDATE public.delivery_verification_codes
  SET
    verified_at = v_now,
    verified_by_user_id = v_user_id,
    updated_at = v_now
  WHERE id = v_verification.id;

  IF p_target = 'food_order'::public.delivery_verification_target THEN
    UPDATE public.food_orders
    SET
      status = 'delivered'::public.food_order_status,
      delivered_at = COALESCE(delivered_at, v_now)
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'target', p_target,
      'order_id', p_order_id,
      'status', 'delivered',
      'verified_at', v_now,
      'completed_at', COALESCE(v_food.delivered_at, v_now)
    );
  ELSIF p_target = 'parcel_ride'::public.delivery_verification_target THEN
    UPDATE public.rides
    SET
      status = 'completed'::public.ride_status,
      completed_at = COALESCE(completed_at, v_now)
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'target', p_target,
      'order_id', p_order_id,
      'status', 'completed',
      'verified_at', v_now,
      'completed_at', COALESCE(v_ride.completed_at, v_now)
    );
  END IF;

  UPDATE public.parcels
  SET
    status = 'delivered'::public.parcel_status,
    delivered_at = COALESCE(delivered_at, v_now),
    otp_verified_at = COALESCE(otp_verified_at, v_now)
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'target', p_target,
    'order_id', p_order_id,
    'status', 'delivered',
    'verified_at', v_now,
    'completed_at', COALESCE(v_parcel.delivered_at, v_now)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_delivery_completion(
  public.delivery_verification_target,
  uuid,
  text
) TO authenticated;
