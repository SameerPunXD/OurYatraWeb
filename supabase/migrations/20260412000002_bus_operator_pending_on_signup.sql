-- Bus operators who self-register should start as pending (same as driver/restaurant).
-- The app no longer exposes bus operator public signup, but this keeps DB behavior consistent.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _role text;
  _status public.account_status;
BEGIN
  _role := NEW.raw_user_meta_data->>'role';

  IF _role IN ('driver', 'restaurant', 'bus_operator') THEN
    _status := 'pending';
  ELSE
    _status := 'approved';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, email, city, account_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.email,
    NEW.raw_user_meta_data->>'city',
    _status
  );

  IF _role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _role::app_role);
  END IF;

  RETURN NEW;
END;
$$;
