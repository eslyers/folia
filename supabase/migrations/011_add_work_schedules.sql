-- Migration 011: Add work_schedules table + manager_id/schedule_id to profiles
-- Enables per-employee work schedules and management hierarchy
-- Schema matches existing API routes: daily_hours, monday..sunday (boolean work days)

-- =====================================================
-- ADD manager_id AND schedule_id TO PROFILES
-- =====================================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES work_schedules(id) ON DELETE SET NULL;

-- =====================================================
-- TABLE: work_schedules
-- =====================================================
CREATE TABLE IF NOT EXISTS work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL,
  daily_hours NUMERIC(4,2) NOT NULL DEFAULT 8,  -- expected hours per workday
  monday BOOLEAN NOT NULL DEFAULT true,
  tuesday BOOLEAN NOT NULL DEFAULT true,
  wednesday BOOLEAN NOT NULL DEFAULT true,
  thursday BOOLEAN NOT NULL DEFAULT true,
  friday BOOLEAN NOT NULL DEFAULT true,
  saturday BOOLEAN NOT NULL DEFAULT false,
  sunday BOOLEAN NOT NULL DEFAULT false,
  tolerance_minutes INTEGER NOT NULL DEFAULT 5,
  start_work TIME DEFAULT '09:00',
  end_work TIME DEFAULT '18:00',
  lunch_duration_minutes INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger for updated_at
CREATE TRIGGER work_schedules_updated_at
  BEFORE UPDATE ON work_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- RLS for work_schedules
-- =====================================================
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;

-- Everyone in tenant can view active schedules
CREATE POLICY "tenant_everyone_view_active_schedules" ON work_schedules
  FOR SELECT USING (
    is_active = true AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Tenant admins can manage all schedules
CREATE POLICY "tenant_admins_manage_schedules" ON work_schedules
  FOR ALL USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Service role can do everything
CREATE POLICY "service_role_work_schedules" ON work_schedules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- SEED DEFAULT SCHEDULES
-- =====================================================
INSERT INTO work_schedules (id, tenant_id, name, daily_hours, monday, tuesday, wednesday, thursday, friday, saturday, sunday, tolerance_minutes, start_work, end_work, lunch_duration_minutes, is_active)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  '8h Padrão CLT',
  8,
  true, true, true, true, true, false, false,
  5,
  '09:00', '18:00', 60,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO work_schedules (id, tenant_id, name, daily_hours, monday, tuesday, wednesday, thursday, friday, saturday, sunday, tolerance_minutes, start_work, end_work, lunch_duration_minutes, is_active)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  '6h Reduzido',
  6,
  true, true, true, true, true, false, false,
  5,
  '09:00', '15:00', 30,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO work_schedules (id, tenant_id, name, daily_hours, monday, tuesday, wednesday, thursday, friday, saturday, sunday, tolerance_minutes, start_work, end_work, lunch_duration_minutes, is_active)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'Horário Flexível',
  8,
  true, true, true, true, true, false, false,
  60,
  '08:00', '18:00', 60,
  true
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- ASSIGN DEFAULT SCHEDULE TO ALL EXISTING PROFILES
-- =====================================================
UPDATE profiles
SET schedule_id = '11111111-1111-1111-1111-111111111111'::UUID
WHERE schedule_id IS NULL;

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_work_schedules_tenant_id ON work_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_schedules_is_active ON work_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_profiles_schedule_id ON profiles(schedule_id);

-- =====================================================
-- UPDATE RLS FOR profiles TO INCLUDE manager VISIBILITY
-- (managers can see their direct reports)
-- =====================================================
DROP POLICY IF EXISTS "tenant_users_view_profiles" ON profiles;
DROP POLICY IF EXISTS "tenant_admins_update_profiles" ON profiles;

-- Users can view profiles within their tenant (self + teammates + manager)
CREATE POLICY "tenant_users_view_profiles" ON profiles
  FOR SELECT USING (
    get_user_tenant(auth.uid()) = tenant_id
    AND (
      auth.uid() = id  -- own profile
      OR manager_id = auth.uid()  -- direct reports
    )
  );

-- Users can update their own profile
CREATE POLICY "tenant_users_update_own_profile" ON profiles
  FOR UPDATE USING (
    auth.uid() = id AND get_user_tenant(auth.uid()) = tenant_id
  ) WITH CHECK (
    role = OLD.role
  );

-- Only tenant admins can insert profiles
CREATE POLICY "tenant_admins_insert_profiles" ON profiles
  FOR INSERT WITH CHECK (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Tenant admins can update profiles in their tenant
CREATE POLICY "tenant_admins_update_profiles" ON profiles
  FOR UPDATE USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- =====================================================
-- RPC: get_team_members
-- Returns direct reports for a manager
-- =====================================================
CREATE OR REPLACE FUNCTION get_team_members(p_manager_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  department TEXT,
  schedule_id UUID,
  vacation_balance INTEGER,
  hours_balance INTEGER,
  hire_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.email,
    p.department,
    p.schedule_id,
    p.vacation_balance,
    p.hours_balance,
    p.hire_date
  FROM profiles p
  WHERE p.manager_id = p_manager_id
    AND p.role = 'employee'
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RPC: get_team_timesheets
-- Returns timesheet summary for all users managed by a manager
-- Used by /api/point/team route
-- =====================================================
CREATE OR REPLACE FUNCTION get_team_timesheets(
  p_manager_id UUID,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  department TEXT,
  schedule_name TEXT,
  daily_hours NUMERIC(4,2),
  total_worked_hours NUMERIC(6,2),
  total_overtime_hours NUMERIC(6,2),
  approved_overtime_hours NUMERIC(6,2),
  overtime_pending_approval NUMERIC(6,2),
  expected_monthly_hours NUMERIC(6,2),
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH
  month_range AS (
    SELECT
      make_date(p_year, p_month, 1) as start_date,
      (make_date(p_year, p_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE as end_date
  ),
  -- Expected monthly hours based on schedule
  schedule_calc AS (
    SELECT
      p.id as user_id,
      COALESCE(ws.name, '8h Padrão CLT') as schedule_name,
      COALESCE(ws.daily_hours, 8)::NUMERIC as daily_hours,
      (
        SELECT COUNT(*)::INTEGER
        FROM generate_series(
          (SELECT start_date FROM month_range),
          (SELECT end_date FROM month_range),
          '1 day'::INTERVAL
        ) d
        WHERE CASE EXTRACT(DOW FROM d)::INTEGER
          WHEN 0 THEN COALESCE(ws.sunday, false)
          WHEN 1 THEN COALESCE(ws.monday, true)
          WHEN 2 THEN COALESCE(ws.tuesday, true)
          WHEN 3 THEN COALESCE(ws.wednesday, true)
          WHEN 4 THEN COALESCE(ws.thursday, true)
          WHEN 5 THEN COALESCE(ws.friday, true)
          WHEN 6 THEN COALESCE(ws.saturday, false)
        END
      ) as work_days_in_month
    FROM profiles p
    LEFT JOIN work_schedules ws ON p.schedule_id = ws.id
    WHERE p.manager_id = p_manager_id AND p.role = 'employee'
  ),
  -- Time entry totals per user
  entry_totals AS (
    SELECT
      te.user_id,
      SUM(te.total_hours) as total_worked_hours,
      SUM(te.overtime_hours) as total_overtime_hours,
      SUM(CASE WHEN te.status = 'closed' AND te.overtime_hours > 0
          THEN te.overtime_hours ELSE 0 END) as overtime_pending
    FROM time_entries te
    WHERE te.date >= (SELECT start_date FROM month_range)
      AND te.date <= (SELECT end_date FROM month_range)
    GROUP BY te.user_id
  ),
  -- Monthly timesheet records
  monthly_ts AS (
    SELECT mt.*
    FROM monthly_timesheets mt
    WHERE mt.month = (SELECT start_date FROM month_range)
  )
  SELECT
    p.id as user_id,
    p.name as user_name,
    p.department,
    sc.schedule_name,
    sc.daily_hours,
    COALESCE(et.total_worked_hours, 0)::NUMERIC(6,2) as total_worked_hours,
    COALESCE(et.total_overtime_hours, 0)::NUMERIC(6,2) as total_overtime_hours,
    COALESCE(mt.approved_overtime_hours, 0)::NUMERIC(6,2) as approved_overtime_hours,
    COALESCE(mt.overtime_pending_approval, 0)::NUMERIC(6,2) as overtime_pending_approval,
    (sc.daily_hours * sc.work_days_in_month)::NUMERIC(6,2) as expected_monthly_hours,
    COALESCE(mt.status, 'open')::TEXT as status
  FROM profiles p
  JOIN schedule_calc sc ON sc.user_id = p.id
  LEFT JOIN entry_totals et ON et.user_id = p.id
  LEFT JOIN monthly_ts mt ON mt.user_id = p.id
  WHERE p.manager_id = p_manager_id AND p.role = 'employee'
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
