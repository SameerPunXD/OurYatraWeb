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

  normalized_seat_numbers := ARRAY(
    SELECT trimmed_value
    FROM (
      SELECT trim(seat_number) AS trimmed_value
      FROM unnest(COALESCE(NEW.seat_numbers, '{}'::text[])) AS seat_number
    ) normalized
    WHERE trimmed_value <> ''
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
    WHERE seat_number !~ '^[0-9]+$'
      OR seat_number::integer < 1
      OR seat_number::integer > bus_total_seats
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
    AND existing_seat.seat_number = ANY(normalized_seat_numbers)
  LIMIT 1;

  IF overlapping_seat IS NOT NULL THEN
    RAISE EXCEPTION 'Seat % is already booked.', overlapping_seat;
  END IF;

  NEW.seat_numbers := normalized_seat_numbers;
  RETURN NEW;
END;
$$;
