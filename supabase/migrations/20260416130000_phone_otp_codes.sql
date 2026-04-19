create extension if not exists pgcrypto;

create table if not exists public.phone_otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  phone_local text not null,
  purpose text not null check (purpose in ('signup', 'password_reset')),
  code_hash text not null,
  provider text not null default 'aakash_sms',
  provider_message_id text,
  provider_response jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  expires_at timestamptz not null,
  verified_at timestamptz,
  invalidated_at timestamptz,
  last_sent_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists phone_otp_codes_lookup_idx
  on public.phone_otp_codes (phone_e164, purpose, created_at desc);

create index if not exists phone_otp_codes_pending_idx
  on public.phone_otp_codes (phone_e164, purpose, verified_at, invalidated_at);

alter table public.phone_otp_codes enable row level security;
