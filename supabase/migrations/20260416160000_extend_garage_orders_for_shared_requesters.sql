alter table public.garage_orders
  add column if not exists requester_id uuid,
  add column if not exists requester_role public.app_role,
  add column if not exists requester_address text,
  add column if not exists requester_lat double precision,
  add column if not exists requester_lng double precision,
  add column if not exists vehicle_info text,
  add column if not exists service_location_mode text not null default 'drop_off';

alter table public.garage_orders
  alter column driver_id drop not null;

update public.garage_orders
set
  requester_id = coalesce(requester_id, driver_id),
  requester_role = coalesce(requester_role, 'driver'::public.app_role),
  requester_address = coalesce(requester_address, driver_address),
  requester_lat = coalesce(requester_lat, driver_lat),
  requester_lng = coalesce(requester_lng, driver_lng),
  service_location_mode = coalesce(service_location_mode, 'drop_off')
where requester_id is null
   or requester_role is null
   or requester_address is null
   or requester_lat is null
   or requester_lng is null
   or service_location_mode is null;

alter table public.garage_orders
  alter column requester_id set not null,
  alter column requester_role set not null,
  alter column service_location_mode set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'garage_orders_requester_role_check'
  ) then
    alter table public.garage_orders
      add constraint garage_orders_requester_role_check
      check (requester_role in ('rider'::public.app_role, 'driver'::public.app_role));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'garage_orders_service_location_mode_check'
  ) then
    alter table public.garage_orders
      add constraint garage_orders_service_location_mode_check
      check (service_location_mode in ('drop_off', 'pickup'));
  end if;
end $$;

create index if not exists garage_orders_requester_lookup_idx
  on public.garage_orders (requester_id, requester_role, created_at desc);

alter table public.garage_services
  add column if not exists vehicle_category text not null default 'both';

update public.garage_services
set vehicle_category = 'both'
where vehicle_category is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'garage_services_vehicle_category_check'
  ) then
    alter table public.garage_services
      add constraint garage_services_vehicle_category_check
      check (vehicle_category in ('two_wheeler', 'four_wheeler', 'both'));
  end if;
end $$;

drop policy if exists "Drivers can view own garage orders" on public.garage_orders;
create policy "Requesters can view own garage orders"
on public.garage_orders for select to authenticated
using (
  auth.uid() = requester_id
  and requester_role in ('rider'::public.app_role, 'driver'::public.app_role)
);

drop policy if exists "Drivers can create own garage orders" on public.garage_orders;
create policy "Requesters can create own garage orders"
on public.garage_orders for insert to authenticated
with check (
  auth.uid() = requester_id
  and requester_role in ('rider'::public.app_role, 'driver'::public.app_role)
);
