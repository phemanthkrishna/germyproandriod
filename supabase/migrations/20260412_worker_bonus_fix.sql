-- ============================================================
-- GetMyPro — Worker Bonus Fix
-- Adds missing columns referenced by useWorkerProgress hook
-- and enables proper anon access on bonus_claims table.
-- ============================================================

-- Add missing columns on workers table (referenced in useWorkerProgress.ts)
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS consecutive_bad_ratings INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resume_stars            INTEGER NOT NULL DEFAULT 0;

-- Ensure orders has a rating column (written by customer in OrderDetail.tsx)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rating INTEGER;

-- Enable RLS on bonus_claims and allow anon access
-- (workers use the anon key — no Supabase Auth JWT)
ALTER TABLE bonus_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "bonus_claims_anon"
  ON bonus_claims FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "bonus_claims_admin"
  ON bonus_claims FOR ALL TO authenticated
  USING (is_admin());
