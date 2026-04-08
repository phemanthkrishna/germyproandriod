CREATE TABLE promo_codes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT        UNIQUE NOT NULL,
  discount_type TEXT       NOT NULL DEFAULT 'fixed',  -- 'fixed' | 'percent'
  discount_value NUMERIC   NOT NULL,
  max_uses     INTEGER     DEFAULT NULL,               -- NULL = unlimited
  used_count   INTEGER     NOT NULL DEFAULT 0,
  valid_from   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until  TIMESTAMPTZ DEFAULT NULL,               -- NULL = never expires
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Admin can do everything (service_role bypasses RLS; anon/authed read active codes for validation)
CREATE POLICY "Public read active promos" ON promo_codes
  FOR SELECT USING (is_active = TRUE);
