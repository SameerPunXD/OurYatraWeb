CREATE OR REPLACE FUNCTION public.bus_seat_label_from_index(_seat_index integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _seat_index IS NULL OR _seat_index < 1 THEN NULL
    WHEN ((_seat_index - 1) % 4) < 2 THEN
      'A' || ((((_seat_index - 1) / 4) * 2) + (((_seat_index - 1) % 4) + 1))::text
    ELSE
      'B' || ((((_seat_index - 1) / 4) * 2) + (((_seat_index - 1) % 4) - 1))::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.bus_seat_index_from_label(_seat_label text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized_label text;
  seat_side text;
  seat_number integer;
  row_index integer;
  seat_offset integer;
BEGIN
  normalized_label := upper(trim(COALESCE(_seat_label, '')));

  IF normalized_label = '' THEN
    RETURN NULL;
  END IF;

  IF normalized_label ~ '^[0-9]+$' THEN
    RETURN normalized_label::integer;
  END IF;

  IF normalized_label !~ '^[AB][0-9]+$' THEN
    RETURN NULL;
  END IF;

  seat_side := left(normalized_label, 1);
  seat_number := substring(normalized_label FROM '([0-9]+)$')::integer;

  IF seat_number < 1 THEN
    RETURN NULL;
  END IF;

  row_index := (seat_number - 1) / 2;
  seat_offset := (seat_number - 1) % 2;

  RETURN row_index * 4
    + CASE WHEN seat_side = 'A' THEN seat_offset ELSE 2 + seat_offset END
    + 1;
END;
$$;

UPDATE public.bus_bookings bb
SET seat_numbers = ARRAY(
  SELECT public.bus_seat_label_from_index(public.bus_seat_index_from_label(existing_seat))
  FROM unnest(COALESCE(bb.seat_numbers, '{}'::text[])) AS existing_seat
  WHERE public.bus_seat_index_from_label(existing_seat) IS NOT NULL
  ORDER BY public.bus_seat_index_from_label(existing_seat)
)
WHERE EXISTS (
  SELECT 1
  FROM unnest(COALESCE(bb.seat_numbers, '{}'::text[])) AS existing_seat
  WHERE public.bus_seat_index_from_label(existing_seat) IS NOT NULL
);

CREATE OR REPLACE FUNCTION public.validate_bus_booking_seats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bus_total_seats integer;
  bus_available_seats integer;
  normalized_seat_numbers text[];
  selected_seat_count integer;
  overlapping_seat text;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT b.total_seats, b.available_seats
    INTO bus_total_seats, bus_available_seats
  FROM public.buses b
  WHERE b.id = NEW.bus_id
  FOR UPDATE;

  IF bus_total_seats IS NULL THEN
    RAISE EXCEPTION 'Bus route not found.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(NEW.seat_numbers, '{}'::text[])) AS seat_number
    WHERE trim(COALESCE(seat_number, '')) <> ''
      AND (
        public.bus_seat_index_from_label(trim(seat_number)) IS NULL
        OR public.bus_seat_index_from_label(trim(seat_number)) < 1
        OR public.bus_seat_index_from_label(trim(seat_number)) > bus_total_seats
      )
  ) THEN
    RAISE EXCEPTION 'One or more selected seats are invalid for this bus.';
  END IF;

  normalized_seat_numbers := ARRAY(
    SELECT normalized_label
    FROM (
      SELECT public.bus_seat_label_from_index(public.bus_seat_index_from_label(trim(seat_number))) AS normalized_label
      FROM unnest(COALESCE(NEW.seat_numbers, '{}'::text[])) AS seat_number
    ) normalized
    WHERE normalized_label IS NOT NULL
    ORDER BY public.bus_seat_index_from_label(normalized_label), normalized_label
  );

  selected_seat_count := COALESCE(array_length(normalized_seat_numbers, 1), 0);

  IF selected_seat_count < 1 THEN
    RAISE EXCEPTION 'Select at least one seat.';
  END IF;

  NEW.seats_booked := selected_seat_count;

  IF bus_available_seats < NEW.seats_booked THEN
    RAISE EXCEPTION 'Not enough seats are available on this bus.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(normalized_seat_numbers) AS seat_number
    WHERE public.bus_seat_index_from_label(seat_number) IS NULL
      OR public.bus_seat_index_from_label(seat_number) < 1
      OR public.bus_seat_index_from_label(seat_number) > bus_total_seats
  ) THEN
    RAISE EXCEPTION 'One or more selected seats are invalid for this bus.';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM (
      SELECT DISTINCT seat_number
      FROM unnest(normalized_seat_numbers) AS seat_number
    ) unique_seats
  ) <> NEW.seats_booked THEN
    RAISE EXCEPTION 'Choose each seat only once.';
  END IF;

  SELECT existing_seat.seat_number
    INTO overlapping_seat
  FROM public.bus_bookings bb
  CROSS JOIN LATERAL unnest(COALESCE(bb.seat_numbers, '{}'::text[])) AS existing_seat(seat_number)
  WHERE bb.bus_id = NEW.bus_id
    AND bb.status <> 'cancelled'
    AND (TG_OP <> 'UPDATE' OR bb.id <> NEW.id)
    AND upper(trim(existing_seat.seat_number)) = ANY(normalized_seat_numbers)
  LIMIT 1;

  IF overlapping_seat IS NOT NULL THEN
    RAISE EXCEPTION 'Seat % is already booked.', overlapping_seat;
  END IF;

  NEW.seat_numbers := normalized_seat_numbers;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_bus_reserved_seats(_bus_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reserved_seats text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.buses b
    WHERE b.id = _bus_id
      AND (
        b.status = 'active'
        OR b.operator_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  ) THEN
    RETURN '{}'::text[];
  END IF;

  SELECT COALESCE(
    array_agg(ordered_seats.seat_number ORDER BY ordered_seats.seat_sort_order, ordered_seats.seat_number),
    '{}'::text[]
  )
    INTO reserved_seats
  FROM (
    SELECT DISTINCT
      public.bus_seat_label_from_index(public.bus_seat_index_from_label(existing_seat.seat_number)) AS seat_number,
      public.bus_seat_index_from_label(existing_seat.seat_number) AS seat_sort_order
    FROM public.bus_bookings bb
    CROSS JOIN LATERAL unnest(COALESCE(bb.seat_numbers, '{}'::text[])) AS existing_seat(seat_number)
    WHERE bb.bus_id = _bus_id
      AND bb.status <> 'cancelled'
      AND public.bus_seat_index_from_label(existing_seat.seat_number) IS NOT NULL
  ) ordered_seats;

  RETURN reserved_seats;
END;
$$;
