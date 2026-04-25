-- ============================================================
-- GetMyPro — Demo / Browse-mode worker account
-- Phone: 0000000000  |  OTP: 123456 (bypassed in app)
-- ============================================================

-- Profile row (same UUID used for both profiles + workers tables)
INSERT INTO profiles (id, phone, name, role)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '0000000000',
  'Demo Worker',
  'worker'
)
ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role;

-- Worker row
INSERT INTO workers (
  id, name, phone, service, service_categories,
  verified, is_active, is_online,
  avg_rating, total_ratings
)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Demo Worker',
  '0000000000',
  'Electrician',
  ARRAY['Electrician'],
  true, true, false,
  4.8, 12
)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      verified = EXCLUDED.verified,
      is_active = EXCLUDED.is_active;
