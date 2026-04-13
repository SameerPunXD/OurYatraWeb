-- Add garage role and garage ordering system

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'garage'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'garage';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.garages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  phone text,
  description text,
  image_url text,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.garage_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.garage_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.garages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_orders ENABLE ROW LEVEL SECURITY;

-- garages policies
DROP POLICY IF EXISTS "Anyone can view garages" ON public.garages;
CREATE POLICY "Anyone can view garages"
ON public.garages FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Garage owners can manage own garage" ON public.garages;
CREATE POLICY "Garage owners can manage own garage"
ON public.garages FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Admins can manage garages" ON public.garages;
CREATE POLICY "Admins can manage garages"
ON public.garages FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- garage services policies
DROP POLICY IF EXISTS "Anyone can view garage services" ON public.garage_services;
CREATE POLICY "Anyone can view garage services"
ON public.garage_services FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Garage owners can manage own services" ON public.garage_services;
CREATE POLICY "Garage owners can manage own services"
ON public.garage_services FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.garages g
    WHERE g.id = garage_services.garage_id AND g.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.garages g
    WHERE g.id = garage_services.garage_id AND g.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can manage garage services" ON public.garage_services;
CREATE POLICY "Admins can manage garage services"
ON public.garage_services FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- garage orders policies
DROP POLICY IF EXISTS "Drivers can view own garage orders" ON public.garage_orders;
CREATE POLICY "Drivers can view own garage orders"
ON public.garage_orders FOR SELECT TO authenticated
USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Drivers can create own garage orders" ON public.garage_orders;
CREATE POLICY "Drivers can create own garage orders"
ON public.garage_orders FOR INSERT TO authenticated
WITH CHECK (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Garage owners can view garage orders" ON public.garage_orders;
CREATE POLICY "Garage owners can view garage orders"
ON public.garage_orders FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.garages g
    WHERE g.id = garage_orders.garage_id AND g.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Garage owners can update garage orders" ON public.garage_orders;
CREATE POLICY "Garage owners can update garage orders"
ON public.garage_orders FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.garages g
    WHERE g.id = garage_orders.garage_id AND g.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.garages g
    WHERE g.id = garage_orders.garage_id AND g.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can manage garage orders" ON public.garage_orders;
CREATE POLICY "Admins can manage garage orders"
ON public.garage_orders FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.set_generic_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_garages_updated_at ON public.garages;
CREATE TRIGGER trg_garages_updated_at BEFORE UPDATE ON public.garages
FOR EACH ROW EXECUTE FUNCTION public.set_generic_updated_at();

DROP TRIGGER IF EXISTS trg_garage_services_updated_at ON public.garage_services;
CREATE TRIGGER trg_garage_services_updated_at BEFORE UPDATE ON public.garage_services
FOR EACH ROW EXECUTE FUNCTION public.set_generic_updated_at();

DROP TRIGGER IF EXISTS trg_garage_orders_updated_at ON public.garage_orders;
CREATE TRIGGER trg_garage_orders_updated_at BEFORE UPDATE ON public.garage_orders
FOR EACH ROW EXECUTE FUNCTION public.set_generic_updated_at();
