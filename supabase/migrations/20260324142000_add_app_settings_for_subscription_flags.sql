create table if not exists public.app_settings (
  key text primary key,
  value_bool boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "Authenticated can read app settings" on public.app_settings;
create policy "Authenticated can read app settings"
on public.app_settings for select to authenticated
using (true);

drop policy if exists "Admins manage app settings" on public.app_settings;
create policy "Admins manage app settings"
on public.app_settings for all to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

insert into public.app_settings (key, value_bool)
values ('require_rider_subscription', false)
on conflict (key) do nothing;
