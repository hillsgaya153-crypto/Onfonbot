-- Onfon Loan Assist — schema + mock seed data
-- Run this in Supabase SQL editor (or `supabase db push`).

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  national_id text unique not null,
  phone_number text unique not null,
  password text not null,             -- TODO: hash before production, plaintext for prototype
  full_name text not null,
  created_at timestamptz default now()
);

create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  device_name text not null,
  principal_amount numeric not null,
  balance_remaining numeric not null,
  current_plan text not null,
  next_due_date date,
  next_due_amount numeric,
  release_status text not null default 'not_requested', -- not_requested | pending | released
  updated_at timestamptz default now()
);

create table if not exists payment_plans (
  id uuid primary key default gen_random_uuid(),
  plan_name text not null,
  installment_frequency text not null,
  description text
);

create table if not exists release_requests (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references loans(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  customer_name text not null,
  device_name text not null,
  status text not null default 'pending', -- pending | released
  requested_at timestamptz default now(),
  released_at timestamptz
);

-- Lock every table down. No policies are added on purpose — this means
-- the anon/authenticated roles get NO access at all. Only the service_role
-- key (used inside your Edge Functions) can read/write. This is what forces
-- all access through the API layer instead of direct client queries.
alter table customers enable row level security;
alter table loans enable row level security;
alter table payment_plans enable row level security;
alter table release_requests enable row level security;

-- ---------- SEED DATA (same as the JS prototype's MOCK_DB) ----------

insert into customers (national_id, phone_number, password, full_name) values
  ('23456789', '0722334455', 'onfon123', 'Grace Wanjiru'),
  ('31987654', '0711223344', 'pass2026', 'Brian Otieno'),
  ('40112233', '0733445566', 'cleared01', 'Faith Mumbi');

insert into loans (customer_id, device_name, principal_amount, balance_remaining, current_plan, next_due_date, next_due_amount, release_status)
select id, 'Samsung A15 128GB', 18500, 6200, 'Weekly', '2026-07-27', 850, 'not_requested'
from customers where national_id = '23456789';

insert into loans (customer_id, device_name, principal_amount, balance_remaining, current_plan, next_due_date, next_due_amount, release_status)
select id, 'Infinix Note 30', 22000, 22000, 'Monthly', '2026-08-05', 3667, 'not_requested'
from customers where national_id = '31987654';

insert into loans (customer_id, device_name, principal_amount, balance_remaining, current_plan, next_due_date, next_due_amount, release_status)
select id, 'Tecno Spark 20', 15900, 0, 'Weekly', null, 0, 'not_requested'
from customers where national_id = '40112233';

insert into payment_plans (plan_name, installment_frequency, description) values
  ('Weekly', 'Every 7 days', 'Lower per-payment amount, more frequent debits'),
  ('Bi-weekly', 'Every 14 days', 'Balanced option, moderate installment size'),
  ('Monthly', 'Every 30 days', 'Larger installment, fewer transactions');
