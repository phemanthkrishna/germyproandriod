-- Active services table — controls which services are bookable
create table if not exists active_services (
  id           uuid        primary key default gen_random_uuid(),
  service_name text        not null unique,
  is_active    boolean     not null default false,
  created_at   timestamptz not null default now()
);

-- Seed all 8 services — only Plumbing and Electrician active
insert into active_services (service_name, is_active) values
  ('Plumbing',    true),
  ('Electrician', true),
  ('Carpentry',   false),
  ('AC Service',  false),
  ('Deep Clean',  false),
  ('Painting',    false),
  ('Bathroom',    false),
  ('Locksmith',   false)
on conflict (service_name) do nothing;

-- RLS
alter table active_services enable row level security;

-- Public read — customer app needs this on load
create policy "active_services_read_all" on active_services
  for select using (true);

-- Only admins can toggle
create policy "active_services_admin_write" on active_services
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
