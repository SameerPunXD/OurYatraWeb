
-- Phase 1: Database fixes

-- 1. Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. Update handle_new_user to save email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.email
  );
  
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::app_role);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Add UPDATE policy on subscriptions for users to cancel own
CREATE POLICY "Users can update own subscriptions"
ON public.subscriptions FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- 5. Backfill existing profiles with email from auth.users
UPDATE public.profiles SET email = u.email
FROM auth.users u WHERE u.id = profiles.id AND profiles.email IS NULL;
