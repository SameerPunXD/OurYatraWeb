CREATE OR REPLACE FUNCTION public.set_rental_orders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.broadcast_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_messages ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_broadcast_messages_updated_at ON public.broadcast_messages;
CREATE TRIGGER trg_broadcast_messages_updated_at
BEFORE UPDATE ON public.broadcast_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Admins manage broadcast messages" ON public.broadcast_messages;
CREATE POLICY "Admins manage broadcast messages"
ON public.broadcast_messages
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated can read broadcast messages" ON public.broadcast_messages;
CREATE POLICY "Authenticated can read broadcast messages"
ON public.broadcast_messages
FOR SELECT
TO authenticated
USING (true);

CREATE TABLE IF NOT EXISTS public.inbox_read_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inbox_type text NOT NULL CHECK (inbox_type IN ('ride', 'system')),
  inbox_id text NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, inbox_type, inbox_id)
);

ALTER TABLE public.inbox_read_states ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_inbox_read_states_updated_at ON public.inbox_read_states;
CREATE TRIGGER trg_inbox_read_states_updated_at
BEFORE UPDATE ON public.inbox_read_states
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Admins can read all inbox read states" ON public.inbox_read_states;
CREATE POLICY "Admins can read all inbox read states"
ON public.inbox_read_states
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can insert own inbox read states" ON public.inbox_read_states;
CREATE POLICY "Users can insert own inbox read states"
ON public.inbox_read_states
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own inbox read states" ON public.inbox_read_states;
CREATE POLICY "Users can read own inbox read states"
ON public.inbox_read_states
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own inbox read states" ON public.inbox_read_states;
CREATE POLICY "Users can update own inbox read states"
ON public.inbox_read_states
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.safalta_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.safalta_ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read all Safalta AI messages" ON public.safalta_ai_messages;
CREATE POLICY "Admins can read all Safalta AI messages"
ON public.safalta_ai_messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can insert own Safalta AI messages" ON public.safalta_ai_messages;
CREATE POLICY "Users can insert own Safalta AI messages"
ON public.safalta_ai_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own Safalta AI messages" ON public.safalta_ai_messages;
CREATE POLICY "Users can read own Safalta AI messages"
ON public.safalta_ai_messages
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.rental_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  vehicle_id text NOT NULL,
  vehicle_name text NOT NULL,
  vehicle_category text NOT NULL,
  service_mode text NOT NULL,
  trip_type text NOT NULL,
  pickup_location text NOT NULL,
  dropoff_location text NOT NULL,
  pickup_date date NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days >= 1 AND duration_days <= 30),
  price_per_hour integer NOT NULL CHECK (price_per_hour >= 0),
  price_per_day integer NOT NULL CHECK (price_per_day >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'rejected')),
  customer_note text,
  operator_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rental_orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS rental_orders_user_id_idx
  ON public.rental_orders (user_id);

CREATE INDEX IF NOT EXISTS rental_orders_operator_id_idx
  ON public.rental_orders (operator_id);

CREATE INDEX IF NOT EXISTS rental_orders_status_idx
  ON public.rental_orders (status);

CREATE INDEX IF NOT EXISTS rental_orders_created_at_idx
  ON public.rental_orders (created_at DESC);

DROP TRIGGER IF EXISTS trg_rental_orders_updated_at ON public.rental_orders;
CREATE TRIGGER trg_rental_orders_updated_at
BEFORE UPDATE ON public.rental_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_rental_orders_updated_at();

DROP POLICY IF EXISTS "Users can view own rental orders" ON public.rental_orders;
CREATE POLICY "Users can view own rental orders"
ON public.rental_orders
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    WHERE ucr.user_id = auth.uid()
      AND ucr.role_slug = 'rental_operator'
  )
);

DROP POLICY IF EXISTS "Users can create own rental orders" ON public.rental_orders;
CREATE POLICY "Users can create own rental orders"
ON public.rental_orders
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Users and operators can update rental orders" ON public.rental_orders;
CREATE POLICY "Users and operators can update rental orders"
ON public.rental_orders
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    WHERE ucr.user_id = auth.uid()
      AND ucr.role_slug = 'rental_operator'
  )
)
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    WHERE ucr.user_id = auth.uid()
      AND ucr.role_slug = 'rental_operator'
  )
);
