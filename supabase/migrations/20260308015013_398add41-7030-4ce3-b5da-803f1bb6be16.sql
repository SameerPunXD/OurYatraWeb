
-- saved_addresses table
CREATE TABLE public.saved_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Custom',
  address text NOT NULL,
  lat double precision,
  lng double precision,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own addresses" ON public.saved_addresses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own addresses" ON public.saved_addresses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses" ON public.saved_addresses
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses" ON public.saved_addresses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- emergency_contacts table
CREATE TABLE public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  relationship text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own emergency contacts" ON public.emergency_contacts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own emergency contacts" ON public.emergency_contacts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own emergency contacts" ON public.emergency_contacts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own emergency contacts" ON public.emergency_contacts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
