-- Payout logs: audit trail for every payout made to workers and stores
CREATE TABLE IF NOT EXISTS payout_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     TEXT REFERENCES orders(id) ON DELETE SET NULL,
  payee_type   TEXT NOT NULL CHECK (payee_type IN ('worker', 'store', 'bonus')),
  payee_id     TEXT,
  payee_name   TEXT NOT NULL,
  payee_upi    TEXT,
  amount       NUMERIC NOT NULL,
  payment_ref  TEXT,          -- UTR / transaction reference entered by admin
  note         TEXT,
  marked_by    TEXT,          -- admin email/name
  paid_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookups by payee and order
CREATE INDEX IF NOT EXISTS payout_logs_payee_idx   ON payout_logs(payee_id);
CREATE INDEX IF NOT EXISTS payout_logs_order_idx   ON payout_logs(order_id);
CREATE INDEX IF NOT EXISTS payout_logs_paid_at_idx ON payout_logs(paid_at DESC);

-- Add mat_cost_store to orders if not present (what store partner is owed)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mat_cost_store NUMERIC;

-- Enable realtime for payout_logs
ALTER TABLE payout_logs REPLICA IDENTITY FULL;

-- RLS: admin full access, others no access
ALTER TABLE payout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_payout_logs" ON payout_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
