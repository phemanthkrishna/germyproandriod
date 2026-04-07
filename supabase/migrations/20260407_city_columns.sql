-- Add city columns for city-scoped order matching

-- Orders: stamp which city the customer is in when they book
alter table orders add column if not exists customer_city text;

-- Workers: which city the worker operates in
alter table workers add column if not exists city text default 'Bobbili';

-- Backfill existing workers to Bobbili (our only active city)
update workers set city = 'Bobbili' where city is null;

-- Index for fast city-filtered order lookups
create index if not exists orders_customer_city_idx on orders(customer_city);
create index if not exists workers_city_idx on workers(city);
