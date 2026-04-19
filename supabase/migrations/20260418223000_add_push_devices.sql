CREATE TABLE IF NOT EXISTS public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL UNIQUE,
  platform text NOT NULL,
  app_build text,
  device_label text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS push_devices_user_id_idx
  ON public.push_devices (user_id);

CREATE INDEX IF NOT EXISTS push_devices_active_user_last_seen_idx
  ON public.push_devices (user_id, last_seen_at DESC)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS update_push_devices_updated_at ON public.push_devices;
CREATE TRIGGER update_push_devices_updated_at
BEFORE UPDATE ON public.push_devices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.upsert_push_device(
  p_expo_push_token text,
  p_platform text,
  p_app_build text DEFAULT NULL,
  p_device_label text DEFAULT NULL
)
RETURNS public.push_devices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_token text := nullif(btrim(p_expo_push_token), '');
  v_platform text := nullif(btrim(p_platform), '');
  v_app_build text := nullif(btrim(p_app_build), '');
  v_device_label text := nullif(btrim(p_device_label), '');
  v_device public.push_devices%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Expo push token is required';
  END IF;

  IF v_platform IS NULL THEN
    RAISE EXCEPTION 'Platform is required';
  END IF;

  INSERT INTO public.push_devices AS existing (
    user_id,
    expo_push_token,
    platform,
    app_build,
    device_label,
    is_active,
    last_seen_at
  )
  VALUES (
    v_user_id,
    v_token,
    v_platform,
    v_app_build,
    v_device_label,
    true,
    now()
  )
  ON CONFLICT (expo_push_token) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform,
    app_build = COALESCE(EXCLUDED.app_build, existing.app_build),
    device_label = COALESCE(EXCLUDED.device_label, existing.device_label),
    is_active = true,
    last_seen_at = now(),
    updated_at = now()
  RETURNING * INTO v_device;

  RETURN v_device;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_push_device(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.deactivate_push_device(p_expo_push_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_token text := nullif(btrim(p_expo_push_token), '');
  v_updated_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_token IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.push_devices
  SET
    is_active = false,
    updated_at = now()
  WHERE user_id = v_user_id
    AND expo_push_token = v_token
    AND is_active = true;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deactivate_push_device(text) TO authenticated;
