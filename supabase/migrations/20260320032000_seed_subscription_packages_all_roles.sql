-- Add 1 month, 5 months, 1 year packages for rider/driver/restaurant/garage
-- Keeps existing historical plans but disables active old plans for these roles

update public.subscription_plans
set is_active = false
where role in ('rider', 'driver', 'restaurant', 'garage');

insert into public.subscription_plans (role, name, price, features, is_active)
values
  -- User / Rider
  ('rider', 'User/Rider - 1 Month', 2000, '["Validity: 1 month", "Book rides, parcels, food", "Standard support"]'::jsonb, true),
  ('rider', 'User/Rider - 5 Months', 9000, '["Validity: 5 months", "Book rides, parcels, food", "Priority support"]'::jsonb, true),
  ('rider', 'User/Rider - 1 Year', 20000, '["Validity: 1 year", "Book rides, parcels, food", "Priority support"]'::jsonb, true),

  -- Driver
  ('driver', 'Driver - 1 Month', 3000, '["Validity: 1 month", "Accept ride & parcel jobs", "Earnings dashboard"]'::jsonb, true),
  ('driver', 'Driver - 5 Months', 13500, '["Validity: 5 months", "Accept ride & parcel jobs", "Priority listing"]'::jsonb, true),
  ('driver', 'Driver - 1 Year', 30000, '["Validity: 1 year", "Accept ride & parcel jobs", "Priority listing"]'::jsonb, true),

  -- Restaurant
  ('restaurant', 'Restaurant - 1 Month', 2500, '["Validity: 1 month", "Menu listing", "Order management"]'::jsonb, true),
  ('restaurant', 'Restaurant - 5 Months', 11250, '["Validity: 5 months", "Menu listing", "Order management", "Priority support"]'::jsonb, true),
  ('restaurant', 'Restaurant - 1 Year', 25000, '["Validity: 1 year", "Menu listing", "Order management", "Featured listing"]'::jsonb, true),

  -- Garage
  ('garage', 'Garage - 1 Month', 2500, '["Validity: 1 month", "Service listing", "Order management"]'::jsonb, true),
  ('garage', 'Garage - 5 Months', 11250, '["Validity: 5 months", "Service listing", "Order management", "Priority support"]'::jsonb, true),
  ('garage', 'Garage - 1 Year', 25000, '["Validity: 1 year", "Service listing", "Order management", "Featured listing"]'::jsonb, true);
