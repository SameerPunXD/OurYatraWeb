
-- Phase A: Fix all critical database issues

-- 1. Fix driver UPDATE policy on rides: allow drivers to accept pending rides
DROP POLICY IF EXISTS "Drivers can update assigned rides" ON public.rides;
CREATE POLICY "Drivers can update assigned rides"
ON public.rides FOR UPDATE TO authenticated
USING (
  auth.uid() = driver_id 
  OR (status = 'pending' AND has_role(auth.uid(), 'driver'))
);

-- 2. Fix driver UPDATE policy on parcels: allow drivers to accept pending parcels
DROP POLICY IF EXISTS "Drivers can update assigned parcels" ON public.parcels;
CREATE POLICY "Drivers can update assigned parcels"
ON public.parcels FOR UPDATE TO authenticated
USING (
  auth.uid() = driver_id 
  OR (status = 'pending' AND has_role(auth.uid(), 'driver'))
);

-- 3. Add INSERT policy on subscriptions
CREATE POLICY "Users can insert own subscriptions"
ON public.subscriptions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. Fix handle_new_user to also save phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone'
  );
  
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::app_role);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parcels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.food_orders;
