CREATE TABLE campaign_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT        NOT NULL,
  body           TEXT        NOT NULL,
  target_role    TEXT        NOT NULL DEFAULT 'all',  -- 'all' | 'customer' | 'worker'
  target_city    TEXT        DEFAULT NULL,
  target_service TEXT        DEFAULT NULL,
  sent_count     INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE campaign_logs ENABLE ROW LEVEL SECURITY;

-- Only service_role (admin edge function + admin app via service key) can insert/read
CREATE POLICY "Admin full access" ON campaign_logs FOR ALL USING (true);
