-- Migration 016: Fix Critical Security Issues (Fase 1 Audit)
-- 1. Fix is_manager_of() self-reference bug
-- 2. Fix handle_new_user() legacy role
-- 3. Fix is_tenant_admin() 1-arg version (uses legacy 'admin' role)
-- 4. Fix get_team_members() legacy role filter

-- =====================================================
-- FIX 1: is_manager_of() — self-reference parameter bug
-- Bug: parameter name "manager_id" shadows column "profiles.manager_id"
--      causing WHERE manager_id = manager_id (always true)
-- Fix: rename parameter to p_manager_id
-- =====================================================
CREATE OR REPLACE FUNCTION is_manager_of(p_manager_id UUID, p_employee_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles
    WHERE id = p_employee_id
      AND manager_id = p_manager_id  -- now correctly references the COLUMN
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- FIX 2: is_tenant_admin() 1-arg version
-- Bug: checks role = 'admin' (legacy) — always false after migration 012
-- Fix: check role IN ('master_admin', 'tenant_admin')
-- NOTE: This is the 1-arg version used by migration 011 (work_schedules RLS).
--       The 2-arg version from migration 012 is already correct.
-- =====================================================
CREATE OR REPLACE FUNCTION is_tenant_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
      AND role IN ('master_admin', 'tenant_admin')
      AND is_tenant_active(tenant_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- FIX 3: handle_new_user() — default role legacy bug
-- Bug: inserts 'employee' which is not recognized by TypeScript RBAC
-- Fix: use 'funcionario' (current canonical role)
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, vacation_balance, hours_balance, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'funcionario',  -- FIX: was 'employee' (legacy)
    30,
    0,
    COALESCE(
      (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1),
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIX 4: get_team_members() — legacy role filter
-- Bug: filters WHERE role = 'employee' — returns 0 rows after migration 012
-- Fix: use 'funcionario'
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
    AND p.role = 'funcionario'  -- FIX: was 'employee' (legacy)
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- FIX 5: get_team_timesheets() — legacy role filter
-- Same issue as get_team_members()
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
    WHERE p.manager_id = p_manager_id AND p.role = 'funcionario'  -- FIX
  ),
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
  WHERE p.manager_id = p_manager_id AND p.role = 'funcionario'  -- FIX
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- FIX 6: Migrate any remaining legacy roles
-- Ensures no user is stuck with 'employee' or 'admin'
-- =====================================================
UPDATE profiles SET role = 'funcionario' WHERE role = 'employee';
UPDATE profiles SET role = 'tenant_admin'  WHERE role = 'admin';
