-- Update subscription plans as per requested monthly pricing
-- Rider: 2000/month
-- Driver: 3000/month
-- Auto Driver: 1000/month (under driver role)
-- Hotel/Restaurant: 1000/month
-- Durations: 1 month, 5 months, 1 year

-- Deactivate existing active plans for rider/driver/restaurant
update public.subscription_plans
set is_active = false
where role in ('rider', 'driver', 'restaurant')
  and is_active = true;

insert into public.subscription_plans (role, name, price, features, is_active)
values
  -- Rider (User)
  ('rider', 'Rider - 1 Month Package', 2000, '["Validity: 1 month", "Book rides, food, and parcels"]'::jsonb, true),
  ('rider', 'Rider - 5 Months Package', 10000, '["Validity: 5 months", "Book rides, food, and parcels"]'::jsonb, true),
  ('rider', 'Rider - 1 Year Package', 24000, '["Validity: 1 year", "Book rides, food, and parcels"]'::jsonb, true),

  -- Driver
  ('driver', 'Driver - 1 Month Package', 3000, '["Validity: 1 month", "Accept rides and parcel jobs"]'::jsonb, true),
  ('driver', 'Driver - 5 Months Package', 15000, '["Validity: 5 months", "Accept rides and parcel jobs"]'::jsonb, true),
  ('driver', 'Driver - 1 Year Package', 36000, '["Validity: 1 year", "Accept rides and parcel jobs"]'::jsonb, true),

  -- Auto Driver (kept in driver role so same dashboard/flow works)
  ('driver', 'Auto Driver - 1 Month Package', 1000, '["Validity: 1 month", "Auto driver ride jobs"]'::jsonb, true),
  ('driver', 'Auto Driver - 5 Months Package', 5000, '["Validity: 5 months", "Auto driver ride jobs"]'::jsonb, true),
  ('driver', 'Auto Driver - 1 Year Package', 12000, '["Validity: 1 year", "Auto driver ride jobs"]'::jsonb, true),

  -- Hotel / Restaurant
  ('restaurant', 'Hotel/Restaurant - 1 Month Package', 1000, '["Validity: 1 month", "Order listing and management"]'::jsonb, true),
  ('restaurant', 'Hotel/Restaurant - 5 Months Package', 5000, '["Validity: 5 months", "Order listing and management"]'::jsonb, true),
  ('restaurant', 'Hotel/Restaurant - 1 Year Package', 12000, '["Validity: 1 year", "Order listing and management"]'::jsonb, true);
