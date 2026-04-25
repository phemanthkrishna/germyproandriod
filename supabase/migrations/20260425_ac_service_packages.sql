-- AC Service Packages table
-- Stores the fixed-price packages for the AC Service flow.
-- Admin can add, edit, and toggle packages from the admin panel.
create table if not exists ac_service_packages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,          -- e.g. "AC General Service"
  description text,                   -- brief description shown to customer
  price       integer not null,       -- total fixed price in ₹
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Trigger to keep updated_at fresh
create or replace function update_ac_packages_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ac_packages_updated_at on ac_service_packages;
create trigger trg_ac_packages_updated_at
  before update on ac_service_packages
  for each row execute function update_ac_packages_updated_at();

-- Add ac_package_id and ac_package_name + ac_package_price to orders table
alter table orders
  add column if not exists ac_package_id    uuid references ac_service_packages(id),
  add column if not exists ac_package_name  text,
  add column if not exists ac_package_price integer,
  add column if not exists ac_remaining_paid boolean not null default false;

-- RLS: everyone can read active packages (for booking page)
alter table ac_service_packages enable row level security;

drop policy if exists "public read active packages" on ac_service_packages;
create policy "public read active packages"
  on ac_service_packages for select
  using (is_active = true);

drop policy if exists "admin full access packages" on ac_service_packages;
create policy "admin full access packages"
  on ac_service_packages for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Seed some default packages
insert into ac_service_packages (name, description, price, sort_order) values
  ('AC General Service',       '1 ton or 1.5 ton split AC — full cleaning & check-up', 699,  1),
  ('AC Deep Service',          'Complete deep clean, coil wash & performance tune-up',  999,  2),
  ('AC Gas Recharge (R22)',    'Gas top-up for R22 refrigerant ACs',                   1299, 3),
  ('AC Gas Recharge (R32/410)','Gas top-up for R32 / R410A refrigerant ACs',           1499, 4),
  ('AC Installation (1–1.5T)', 'Standard split AC installation up to 1.5 ton',         1799, 5),
  ('AC Uninstallation',        'Safe removal & packing of split AC unit',               799,  6)
on conflict do nothing;
