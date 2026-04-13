
-- Phase 1: Full database schema for auth, access control, communication & feedback

-- 1. Storage bucket for uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true);

-- Storage RLS: anyone can read, authenticated can upload
CREATE POLICY "Anyone can read uploads" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'uploads');
CREATE POLICY "Users can update own uploads" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own uploads" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Account status enum
CREATE TYPE public.account_status AS ENUM ('pending', 'approved', 'rejected', 'blocked');

-- 3. Profiles additions
ALTER TABLE public.profiles
  ADD COLUMN city text,
  ADD COLUMN account_status public.account_status NOT NULL DEFAULT 'approved',
  ADD COLUMN is_flagged boolean NOT NULL DEFAULT false;

-- 4. Driver profiles table
CREATE TABLE public.driver_profiles (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL DEFAULT 'bike',
  license_number text NOT NULL DEFAULT '',
  national_id_url text,
  vehicle_registration_url text,
  profile_photo_url text,
  vehicle_photo_url text,
  availability text NOT NULL DEFAULT 'both',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can read own driver profile" ON public.driver_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Owner can update own driver profile" ON public.driver_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Owner can insert own driver profile" ON public.driver_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin can read all driver profiles" ON public.driver_profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can manage driver profiles" ON public.driver_profiles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_driver_profiles_updated_at BEFORE UPDATE ON public.driver_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Add business_license_url to restaurants
ALTER TABLE public.restaurants ADD COLUMN business_license_url text;

-- 6. Ratings table
CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  order_type text NOT NULL,
  rating integer NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own ratings" ON public.ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Users can read own sent ratings" ON public.ratings FOR SELECT TO authenticated USING (auth.uid() = from_user_id);
CREATE POLICY "Users can read received ratings" ON public.ratings FOR SELECT TO authenticated USING (auth.uid() = to_user_id);
CREATE POLICY "Restaurant owners can read restaurant ratings" ON public.ratings FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.restaurants WHERE restaurants.id = ratings.restaurant_id AND restaurants.owner_id = auth.uid())
);
CREATE POLICY "Admin can read all ratings" ON public.ratings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. Chat messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  order_type text NOT NULL,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can insert own messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Authenticated can read messages" ON public.chat_messages FOR SELECT TO authenticated USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- 8. Notifications table (persistent)
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'general',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can read all notifications" ON public.notifications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 9. Update handle_new_user trigger
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
  
  IF _role IN ('driver', 'restaurant') THEN
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

-- 10. notify_user function
CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _title text, _message text, _type text DEFAULT 'general')
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_user_id, _title, _message, _type);
$$;
