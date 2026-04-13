-- Custom role mechanism (safe extension over existing app_role enum)

create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  base_role public.app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_custom_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_slug text not null references public.custom_roles(slug) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, role_slug)
);

alter table public.subscription_plans
  add column if not exists custom_role_slug text null references public.custom_roles(slug) on delete set null;

alter table public.custom_roles enable row level security;
alter table public.user_custom_roles enable row level security;

-- custom_roles policies
DROP POLICY IF EXISTS "Anyone can view active custom roles" ON public.custom_roles;
DROP POLICY IF EXISTS "Admins manage custom roles" ON public.custom_roles;

create policy "Anyone can view active custom roles"
on public.custom_roles for select to authenticated
using (is_active = true or public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins manage custom roles"
on public.custom_roles for all to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- user_custom_roles policies
DROP POLICY IF EXISTS "Users view own custom roles" ON public.user_custom_roles;
DROP POLICY IF EXISTS "Users insert own custom role link" ON public.user_custom_roles;
DROP POLICY IF EXISTS "Admins manage custom role links" ON public.user_custom_roles;

create policy "Users view own custom roles"
on public.user_custom_roles for select to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Users insert own custom role link"
on public.user_custom_roles for insert to authenticated
with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins manage custom role links"
on public.user_custom_roles for all to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- seed built-in custom role
insert into public.custom_roles (slug, label, base_role, is_active)
values ('auto_driver', 'Auto Driver', 'driver', true)
on conflict (slug) do update set label = excluded.label, base_role = excluded.base_role, is_active = true;
