alter table public.driver_profiles
  add column if not exists vehicle_brand text;

update public.driver_profiles
set vehicle_brand = coalesce(vehicle_brand, vehicle_type)
where vehicle_brand is null;
