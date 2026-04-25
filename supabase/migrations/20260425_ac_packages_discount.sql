-- Add discount fields to ac_service_packages
ALTER TABLE ac_service_packages
  ADD COLUMN IF NOT EXISTS discount_pct   integer NOT NULL DEFAULT 0,   -- e.g. 20 means 20% off
  ADD COLUMN IF NOT EXISTS discount_start timestamptz,                  -- NULL = no start restriction
  ADD COLUMN IF NOT EXISTS discount_end   timestamptz;                  -- NULL = no end restriction
