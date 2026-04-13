-- Add bus_operator role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'bus_operator'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'bus_operator';
  END IF;
END $$;

-- buses table: each row is a scheduled bus trip posted by an operator
CREATE TABLE IF NOT EXISTS public.buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bus_name text NOT NULL,
  bus_number text NOT NULL,
  from_district text NOT NULL,
  to_district text NOT NULL,
  departure_date date NOT NULL,
  departure_time time NOT NULL,
  arrival_time time,
  total_seats integer NOT NULL DEFAULT 30,
  available_seats integer NOT NULL DEFAULT 30,
  price numeric(10,2) NOT NULL,
  amenities text[] DEFAULT '{}',
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- bus_bookings table: user books seats on a bus
CREATE TABLE IF NOT EXISTS public.bus_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seats_booked integer NOT NULL DEFAULT 1,
  total_amount numeric(10,2) NOT NULL,
  passenger_name text,
  passenger_phone text,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can search active buses" ON public.buses;
CREATE POLICY "Anyone can search active buses"
  ON public.buses FOR SELECT TO authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS "Bus operators can manage own buses" ON public.buses;
CREATE POLICY "Bus operators can manage own buses"
  ON public.buses FOR ALL TO authenticated
  USING (auth.uid() = operator_id)
  WITH CHECK (auth.uid() = operator_id);

DROP POLICY IF EXISTS "Admins can manage buses" ON public.buses;
CREATE POLICY "Admins can manage buses"
  ON public.buses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can view own bus bookings" ON public.bus_bookings;
CREATE POLICY "Users can view own bus bookings"
  ON public.bus_bookings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create bus bookings" ON public.bus_bookings;
CREATE POLICY "Users can create bus bookings"
  ON public.bus_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can cancel own bus bookings" ON public.bus_bookings;
CREATE POLICY "Users can cancel own bus bookings"
  ON public.bus_bookings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Bus operators can view bookings for their buses" ON public.bus_bookings;
CREATE POLICY "Bus operators can view bookings for their buses"
  ON public.bus_bookings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.buses b
      WHERE b.id = bus_bookings.bus_id AND b.operator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage bus bookings" ON public.bus_bookings;
CREATE POLICY "Admins can manage bus bookings"
  ON public.bus_bookings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.handle_bus_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.buses
  SET available_seats = available_seats - NEW.seats_booked,
      updated_at = now()
  WHERE id = NEW.bus_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bus_booking_seats ON public.bus_bookings;
CREATE TRIGGER trg_bus_booking_seats
  AFTER INSERT ON public.bus_bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_bus_booking();

CREATE OR REPLACE FUNCTION public.handle_bus_booking_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE public.buses
    SET available_seats = available_seats + OLD.seats_booked,
        updated_at = now()
    WHERE id = OLD.bus_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bus_booking_cancel ON public.bus_bookings;
CREATE TRIGGER trg_bus_booking_cancel
  AFTER UPDATE ON public.bus_bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_bus_booking_cancel();

DROP TRIGGER IF EXISTS trg_buses_updated_at ON public.buses;
CREATE TRIGGER trg_buses_updated_at
  BEFORE UPDATE ON public.buses
  FOR EACH ROW EXECUTE FUNCTION public.set_generic_updated_at();

DROP TRIGGER IF EXISTS trg_bus_bookings_updated_at ON public.bus_bookings;
CREATE TRIGGER trg_bus_bookings_updated_at
  BEFORE UPDATE ON public.bus_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_generic_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.bus_bookings;
