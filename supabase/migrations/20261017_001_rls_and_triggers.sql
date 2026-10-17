-- ============================================================
-- 1. Enable RLS on all tables
-- ============================================================
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Helper: get the org_id for the current auth user
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT org_id FROM public.users WHERE id = auth.uid();
$$;

-- Helper: get planner_visibility for an org
CREATE OR REPLACE FUNCTION public.org_visibility(p_org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT planner_visibility::text FROM public.organisations WHERE id = p_org_id;
$$;

-- ============================================================
-- 3. USERS table policies
-- ============================================================
-- Users can read colleagues in the same org
CREATE POLICY "users_select_same_org" ON users FOR SELECT
  USING (org_id = public.current_user_org_id() OR id = auth.uid());

-- Users can only update their own row
CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (id = auth.uid());

-- Insert is done by the trigger / service role
CREATE POLICY "users_insert_self" ON users FOR INSERT
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 4. ORGANISATIONS policies
-- ============================================================
CREATE POLICY "orgs_select_own" ON organisations FOR SELECT
  USING (id = public.current_user_org_id());

CREATE POLICY "orgs_update_founder" ON organisations FOR UPDATE
  USING (
    id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'founder'
    )
  );

-- ============================================================
-- 5. WRITE policies: owner only (user_id = auth.uid())
-- ============================================================
-- Goals
CREATE POLICY "goals_insert_own" ON goals FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "goals_update_own" ON goals FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "goals_delete_own" ON goals FOR DELETE
  USING (user_id = auth.uid());

-- Sub-goals
CREATE POLICY "sub_goals_insert_own" ON sub_goals FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = sub_goals.goal_id AND goals.user_id = auth.uid())
  );
CREATE POLICY "sub_goals_update_own" ON sub_goals FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = sub_goals.goal_id AND goals.user_id = auth.uid())
  );
CREATE POLICY "sub_goals_delete_own" ON sub_goals FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = sub_goals.goal_id AND goals.user_id = auth.uid())
  );

-- Actions
CREATE POLICY "actions_insert_own" ON actions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = actions.goal_id AND goals.user_id = auth.uid())
  );
CREATE POLICY "actions_update_own" ON actions FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = actions.goal_id AND goals.user_id = auth.uid())
  );
CREATE POLICY "actions_delete_own" ON actions FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = actions.goal_id AND goals.user_id = auth.uid())
  );

-- Time blocks
CREATE POLICY "time_blocks_insert_own" ON time_blocks FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "time_blocks_update_own" ON time_blocks FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "time_blocks_delete_own" ON time_blocks FOR DELETE
  USING (user_id = auth.uid());

-- Daily pages
CREATE POLICY "daily_pages_insert_own" ON daily_pages FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "daily_pages_update_own" ON daily_pages FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "daily_pages_delete_own" ON daily_pages FOR DELETE
  USING (user_id = auth.uid());

-- Weekly plans
CREATE POLICY "weekly_plans_insert_own" ON weekly_plans FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "weekly_plans_update_own" ON weekly_plans FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "weekly_plans_delete_own" ON weekly_plans FOR DELETE
  USING (user_id = auth.uid());

-- Monthly plans
CREATE POLICY "monthly_plans_insert_own" ON monthly_plans FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "monthly_plans_update_own" ON monthly_plans FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "monthly_plans_delete_own" ON monthly_plans FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 6. READ policies: shared schedule data (time_blocks, daily_pages)
--    Anyone in the same org can read
-- ============================================================
CREATE POLICY "time_blocks_select_same_org" ON time_blocks FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = time_blocks.user_id
        AND u.org_id = public.current_user_org_id()
    )
  );

CREATE POLICY "daily_pages_select_same_org" ON daily_pages FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = daily_pages.user_id
        AND u.org_id = public.current_user_org_id()
    )
  );

-- ============================================================
-- 7. READ policies: private data (goals, sub_goals, actions,
--    weekly_plans, monthly_plans)
--    Owner only, OR entire company when planner_visibility = 'full'
-- ============================================================
CREATE POLICY "goals_select" ON goals FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = goals.user_id
          AND u.org_id = public.current_user_org_id()
      )
      AND public.org_visibility(public.current_user_org_id()) = 'full'
    )
  );

CREATE POLICY "sub_goals_select" ON sub_goals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM goals g
      WHERE g.id = sub_goals.goal_id
        AND (
          g.user_id = auth.uid()
          OR (
            EXISTS (
              SELECT 1 FROM users u
              WHERE u.id = g.user_id
                AND u.org_id = public.current_user_org_id()
            )
            AND public.org_visibility(public.current_user_org_id()) = 'full'
          )
        )
    )
  );

CREATE POLICY "actions_select" ON actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM goals g
      WHERE g.id = actions.goal_id
        AND (
          g.user_id = auth.uid()
          OR (
            EXISTS (
              SELECT 1 FROM users u
              WHERE u.id = g.user_id
                AND u.org_id = public.current_user_org_id()
            )
            AND public.org_visibility(public.current_user_org_id()) = 'full'
          )
        )
    )
  );

CREATE POLICY "weekly_plans_select" ON weekly_plans FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = weekly_plans.user_id
          AND u.org_id = public.current_user_org_id()
      )
      AND public.org_visibility(public.current_user_org_id()) = 'full'
    )
  );

CREATE POLICY "monthly_plans_select" ON monthly_plans FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = monthly_plans.user_id
          AND u.org_id = public.current_user_org_id()
      )
      AND public.org_visibility(public.current_user_org_id()) = 'full'
    )
  );

-- ============================================================
-- 8. INVITES policies
-- ============================================================
CREATE POLICY "invites_select" ON invites FOR SELECT
  USING (
    org_id = public.current_user_org_id()
    OR email = (SELECT email FROM users WHERE id = auth.uid())
  );

CREATE POLICY "invites_insert" ON invites FOR INSERT
  WITH CHECK (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('founder', 'manager')
    )
  );

CREATE POLICY "invites_delete" ON invites FOR DELETE
  USING (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('founder', 'manager')
    )
  );

-- ============================================================
-- 9. View: daily_pages for colleagues (strips private fields)
-- ============================================================
CREATE OR REPLACE VIEW public.daily_pages_shared AS
SELECT
  id,
  user_id,
  date,
  top3,
  matrix,
  -- water, fitness, notes are PRIVATE — excluded
  created_at,
  updated_at
FROM public.daily_pages;

-- Grant access to the view through RLS on the base table
GRANT SELECT ON public.daily_pages_shared TO authenticated;

-- ============================================================
-- 10. Trigger: create users row on auth sign-up
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Drop if exists so migration is re-runnable
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
