-- ============================================================
-- Seed: 3 test accounts in Company A, 1 in Company B
-- Run this AFTER creating auth users via Supabase dashboard or CLI
-- ============================================================

-- Company A
INSERT INTO organisations (id, name, plan, seats, planner_visibility)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Company A', 'pro', 10, 'schedule')
ON CONFLICT (id) DO NOTHING;

-- Company B
INSERT INTO organisations (id, name, plan, seats, planner_visibility)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Company B', 'free', 5, 'schedule')
ON CONFLICT (id) DO NOTHING;

-- NOTE: You must first create these auth users in Supabase Auth (dashboard or CLI).
-- Then update the UUIDs below to match auth.users.id for each test user.
-- Example placeholder IDs:

-- Company A: founder
-- UPDATE users SET org_id = 'a0000000-0000-0000-0000-000000000001', role = 'founder'
-- WHERE email = 'founder@companya.test';

-- Company A: manager
-- UPDATE users SET org_id = 'a0000000-0000-0000-0000-000000000001', role = 'manager'
-- WHERE email = 'manager@companya.test';

-- Company A: employee
-- UPDATE users SET org_id = 'a0000000-0000-0000-0000-000000000001', role = 'employee'
-- WHERE email = 'employee@companya.test';

-- Company B: founder
-- UPDATE users SET org_id = 'b0000000-0000-0000-0000-000000000001', role = 'founder'
-- WHERE email = 'founder@companyb.test';
