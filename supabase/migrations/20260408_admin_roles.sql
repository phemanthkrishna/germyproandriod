-- Admin sub-roles for backoffice access control
-- Stored alongside the existing role='admin' flag in profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_role TEXT
  CHECK (admin_role IN ('admin', 'manager', 'accountant'));

-- Existing admin accounts default to 'admin' (full access)
UPDATE profiles SET admin_role = 'admin' WHERE role = 'admin' AND admin_role IS NULL;

-- Role definitions (documentation comment only — enforced in app layer):
-- admin      → full access to everything including account management
-- manager    → Orders, Workers, Materials, Stores, Cities, Services, Promos, Campaigns
--              (no Payments, no Analytics, no Accounts)
-- accountant → Payments, Materials, Analytics only
