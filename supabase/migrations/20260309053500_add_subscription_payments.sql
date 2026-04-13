create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_id uuid not null references public.subscription_plans(id) on delete cascade,
  transaction_uuid text not null unique,
  expected_amount numeric not null,
  paid_amount numeric,
  status text not null default 'pending',
  ref_id text,
  provider text not null default 'esewa',
  environment text not null default 'test',
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscription_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='subscription_payments' and policyname='Users can view own subscription payments'
  ) then
    create policy "Users can view own subscription payments"
      on public.subscription_payments
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='subscription_payments' and policyname='Users can create own subscription payments'
  ) then
    create policy "Users can create own subscription payments"
      on public.subscription_payments
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.set_subscription_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_subscription_payments_updated_at on public.subscription_payments;
create trigger trg_subscription_payments_updated_at
before update on public.subscription_payments
for each row
execute function public.set_subscription_payments_updated_at();
