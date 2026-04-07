-- Add lat/lng to service_cities for 10km radius check
alter table service_cities add column if not exists lat double precision;
alter table service_cities add column if not exists lng double precision;

-- Set Bobbili coordinates
update service_cities set lat = 18.5730, lng = 83.3599 where city_name = 'Bobbili';
