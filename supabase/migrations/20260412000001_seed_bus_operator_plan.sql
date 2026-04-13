-- Seed subscription plan for bus operators.
-- This must be separate from the enum addition migration.
INSERT INTO public.subscription_plans (role, name, price, features)
VALUES (
  'bus_operator',
  'Bus Operator Monthly',
  4000,
  '["List unlimited bus routes", "Seat management", "Booking dashboard", "Passenger notifications", "Priority support"]'::jsonb
)
ON CONFLICT DO NOTHING;
