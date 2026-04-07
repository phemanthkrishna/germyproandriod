-- Service cities table — controls which cities Getmypro is active in
create table if not exists service_cities (
  id          uuid        primary key default gen_random_uuid(),
  city_name   text        not null unique,
  state       text        not null default 'Andhra Pradesh',
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- Seed Bobbili as the first active city
insert into service_cities (city_name, state, is_active)
values ('Bobbili', 'Andhra Pradesh', true)
on conflict (city_name) do nothing;

-- RLS
alter table service_cities enable row level security;

-- Public read — needed for city gate check on app load (anon users)
create policy "service_cities_read_all" on service_cities
  for select using (true);

-- Only admins can manage cities
create policy "service_cities_admin_write" on service_cities
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
