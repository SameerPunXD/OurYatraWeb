CREATE OR REPLACE FUNCTION public.normalize_requested_signup_role(_raw_role text, _requested_role text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_role text := lower(btrim(coalesce(_raw_role, '')));
  v_requested text := lower(btrim(coalesce(_requested_role, '')));
BEGIN
  IF v_requested = 'user' THEN
    RETURN 'rider';
  END IF;

  IF v_requested IN ('rider_partner', 'auto_driver', 'rider', 'driver', 'restaurant', 'garage', 'admin', 'bus_operator') THEN
    RETURN v_requested;
  END IF;

  IF v_role = 'user' THEN
    RETURN 'rider';
  END IF;

  IF v_role IN ('rider_partner', 'auto_driver', 'rider', 'driver', 'restaurant', 'garage', 'admin', 'bus_operator') THEN
    RETURN v_role;
  END IF;

  RETURN 'rider';
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_signup_base_role(_raw_role text, _requested_role text DEFAULT NULL)
RETURNS public.app_role
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_role text := lower(btrim(coalesce(_raw_role, '')));
  v_requested text := public.normalize_requested_signup_role(_raw_role, _requested_role);
BEGIN
  IF v_role = 'user' THEN
    RETURN 'rider'::public.app_role;
  END IF;

  IF v_role IN ('rider_partner', 'auto_driver') THEN
    RETURN 'driver'::public.app_role;
  END IF;

  IF v_role IN ('rider', 'driver', 'restaurant', 'garage', 'admin', 'bus_operator') THEN
    RETURN v_role::public.app_role;
  END IF;

  IF v_requested IN ('rider_partner', 'auto_driver') THEN
    RETURN 'driver'::public.app_role;
  END IF;

  IF v_requested IN ('rider', 'driver', 'restaurant', 'garage', 'admin', 'bus_operator') THEN
    RETURN v_requested::public.app_role;
  END IF;

  RETURN 'rider'::public.app_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.default_account_status_for_role(_role public.app_role)
RETURNS public.account_status
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _role IN ('driver'::public.app_role, 'restaurant'::public.app_role, 'garage'::public.app_role, 'bus_operator'::public.app_role)
      THEN 'pending'::public.account_status
    ELSE 'approved'::public.account_status
  END
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_role public.app_role := public.normalize_signup_base_role(
    NEW.raw_user_meta_data->>'role',
    NEW.raw_user_meta_data->>'requested_role'
  );
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email, city, account_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.email,
    NEW.raw_user_meta_data->>'city',
    public.default_account_status_for_role(v_role)
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_current_user_role()
RETURNS TABLE (ensured_role public.app_role, role_was_inserted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_role public.app_role;
  v_requested_role text;
  v_insert_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_user
  FROM auth.users
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  v_role := public.normalize_signup_base_role(
    v_user.raw_user_meta_data->>'role',
    v_user.raw_user_meta_data->>'requested_role'
  );
  v_requested_role := public.normalize_requested_signup_role(
    v_user.raw_user_meta_data->>'role',
    v_user.raw_user_meta_data->>'requested_role'
  );

  INSERT INTO public.profiles (id, full_name, phone, email, city, account_status)
  VALUES (
    v_user.id,
    COALESCE(v_user.raw_user_meta_data->>'full_name', ''),
    v_user.raw_user_meta_data->>'phone',
    v_user.email,
    v_user.raw_user_meta_data->>'city',
    public.default_account_status_for_role(v_role)
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE auth.users
  SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', v_role::text, 'requested_role', v_requested_role)
  WHERE id = v_user.id
    AND (
      coalesce(raw_user_meta_data->>'role', '') IS DISTINCT FROM v_role::text
      OR coalesce(raw_user_meta_data->>'requested_role', '') IS DISTINCT FROM v_requested_role
    );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  GET DIAGNOSTICS v_insert_count = ROW_COUNT;

  ensured_role := v_role;
  role_was_inserted := v_insert_count > 0;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_current_user_role() TO authenticated;

WITH normalized_users AS (
  SELECT
    u.id,
    public.normalize_signup_base_role(u.raw_user_meta_data->>'role', u.raw_user_meta_data->>'requested_role') AS base_role,
    public.normalize_requested_signup_role(u.raw_user_meta_data->>'role', u.raw_user_meta_data->>'requested_role') AS requested_role
  FROM auth.users u
  WHERE lower(btrim(coalesce(u.raw_user_meta_data->>'role', ''))) = 'user'
     OR NOT EXISTS (
       SELECT 1
       FROM public.user_roles r
       WHERE r.user_id = u.id
     )
)
UPDATE auth.users u
SET raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', n.base_role::text, 'requested_role', n.requested_role)
FROM normalized_users n
WHERE u.id = n.id;

WITH normalized_users AS (
  SELECT
    u.id,
    public.normalize_signup_base_role(u.raw_user_meta_data->>'role', u.raw_user_meta_data->>'requested_role') AS base_role
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_roles r
    WHERE r.user_id = u.id
  )
)
UPDATE public.profiles p
SET account_status = public.default_account_status_for_role(n.base_role)
FROM normalized_users n
WHERE p.id = n.id;

WITH normalized_users AS (
  SELECT
    u.id,
    public.normalize_signup_base_role(u.raw_user_meta_data->>'role', u.raw_user_meta_data->>'requested_role') AS base_role
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_roles r
    WHERE r.user_id = u.id
  )
)
INSERT INTO public.user_roles (user_id, role)
SELECT n.id, n.base_role
FROM normalized_users n
ON CONFLICT (user_id, role) DO NOTHING;
