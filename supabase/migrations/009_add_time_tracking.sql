-- Migration 009: Add Time Tracking (Controle de Ponto) - CORRIGIDO
-- Tables: work_schedules, time_entries, monthly_timesheets
-- Profile updates: manager_id, department, schedule_id
-- IMPORTANT: daily_hours is per-SCHEDULE (each tenant defines its own), not fixed at 8h

-- =====================================================
-- TABLE: work_schedules
-- =====================================================
CREATE TABLE IF NOT EXISTS work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL, -- e.g. '8h Padrão CLT', '7h Teletrabalho', '9h Flexível', '6h Part-time'
  daily_hours NUMERIC(4,2) NOT NULL DEFAULT 8.00, -- hours per WORKED day (tenant-defined, not fixed!)
  monday BOOLEAN DEFAULT true,
  tuesday BOOLEAN DEFAULT true,
  wednesday BOOLEAN DEFAULT true,
  thursday BOOLEAN DEFAULT true,
  friday BOOLEAN DEFAULT true,
  saturday BOOLEAN DEFAULT false,
  sunday BOOLEAN DEFAULT false,
  tolerance_minutes INT DEFAULT 5,
  start_work TIME DEFAULT '09:00', -- workday start
  end_work TIME DEFAULT '18:00', -- workday end
  lunch_duration_minutes INT DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER work_schedules_updated_at
  BEFORE UPDATE ON work_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;

-- Only tenant admins can manage work_schedules
CREATE POLICY "tenant_admins_manage_work_schedules" ON work_schedules
  FOR ALL USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Everyone can view active work_schedules in their tenant
CREATE POLICY "tenant_everyone_view_work_schedules" ON work_schedules
  FOR SELECT USING (
    is_active = true AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Service role can do everything
CREATE POLICY "service_role_work_schedules" ON work_schedules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_work_schedules_tenant_id ON work_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_schedules_is_active ON work_schedules(is_active);

-- =====================================================
-- TABLE: time_entries (Batidas de ponto)
-- =====================================================
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  clock_in TIME,
  clock_out TIME,
  lunch_start TIME,
  lunch_end TIME,
  total_hours NUMERIC(5,2) DEFAULT 0,
  overtime_hours NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'adjustment')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TRIGGER time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own time entries
CREATE POLICY "tenant_users_own_time_entries" ON time_entries
  FOR ALL USING (
    auth.uid() = user_id AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Tenant admins can view all time entries in their tenant
CREATE POLICY "tenant_admins_view_time_entries" ON time_entries
  FOR SELECT USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Service role can do everything
CREATE POLICY "service_role_time_entries" ON time_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_id ON time_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, date);

-- =====================================================
-- TABLE: monthly_timesheets (Fechamento mensal)
-- =====================================================
CREATE TABLE IF NOT EXISTS monthly_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  user_id UUID NOT NULL,
  month DATE NOT NULL, -- First day of the month
  total_worked_hours NUMERIC(6,2) DEFAULT 0,
  total_overtime_hours NUMERIC(6,2) DEFAULT 0,
  approved_overtime_hours NUMERIC(6,2) DEFAULT 0,
  overtime_pending_approval NUMERIC(6,2) DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected')),
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month)
);

CREATE TRIGGER monthly_timesheets_updated_at
  BEFORE UPDATE ON monthly_timesheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE monthly_timesheets ENABLE ROW LEVEL SECURITY;

-- Users can view their own monthly timesheets
CREATE POLICY "tenant_users_own_timesheets" ON monthly_timesheets
  FOR SELECT USING (
    auth.uid() = user_id AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Tenant admins can manage timesheets
CREATE POLICY "tenant_admins_manage_timesheets" ON monthly_timesheets
  FOR ALL USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Service role can do everything
CREATE POLICY "service_role_monthly_timesheets" ON monthly_timesheets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_monthly_timesheets_tenant_id ON monthly_timesheets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monthly_timesheets_user_id ON monthly_timesheets(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_timesheets_month ON monthly_timesheets(month);

-- =====================================================
-- PROFILE UPDATES: Add manager_id, department, schedule_id
-- =====================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_id UUID;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES work_schedules(id);

-- Add RLS policy for manager visibility
CREATE POLICY "tenant_users_view_manager" ON profiles
  FOR SELECT USING (
    auth.uid() = id OR
    is_tenant_admin(auth.uid()) OR
    auth.uid() = manager_id
  );

-- =====================================================
-- HELPER FUNCTION: calculate_time_entry_totals
-- Calculates total hours and overtime based on the user's schedule
-- overtime = worked_hours - expected_hours_for_this_day
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_time_entry_totals(
  p_clock_in TIME,
  p_clock_out TIME,
  p_lunch_start TIME,
  p_lunch_end TIME,
  p_user_id UUID DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  v_work_hours NUMERIC(5,2);
  v_lunch_hours NUMERIC(5,2) := 0;
  v_total_hours NUMERIC(5,2);
  v_overtime_hours NUMERIC(5,2) := 0;
  v_expected_hours NUMERIC(4,2);
BEGIN
  -- Calculate work hours (clock_out - clock_in)
  IF p_clock_in IS NOT NULL AND p_clock_out IS NOT NULL THEN
    v_work_hours := EXTRACT(EPOCH FROM (p_clock_out - p_clock_in)) / 3600;
  ELSE
    v_work_hours := 0;
  END IF;

  -- Subtract lunch duration
  IF p_lunch_start IS NOT NULL AND p_lunch_end IS NOT NULL THEN
    v_lunch_hours := EXTRACT(EPOCH FROM (p_lunch_end - p_lunch_start)) / 3600;
  END IF;

  v_total_hours := GREATEST(0, ROUND((v_work_hours - v_lunch_hours)::NUMERIC, 2));

  -- Get expected hours for this user on this date from their schedule
  v_expected_hours := get_expected_hours_for_date(p_user_id, p_date);

  -- Overtime = total_hours - expected_hours (can be negative = under-hours)
  v_overtime_hours := ROUND(GREATEST(-v_expected_hours, v_total_hours - v_expected_hours)::NUMERIC, 2);

  RETURN jsonb_build_object(
    'total_hours', v_total_hours,
    'overtime_hours', v_overtime_hours,
    'lunch_hours', ROUND(v_lunch_hours::NUMERIC, 2),
    'expected_hours', v_expected_hours
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: get_user_schedule
-- Returns the work schedule for a user (assigned or default for tenant)
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_schedule(p_user_id UUID)
RETURNS work_schedules AS $$
DECLARE
  v_schedule work_schedules%ROWTYPE;
  v_user_tenant UUID;
BEGIN
  v_user_tenant := get_user_tenant(p_user_id);

  -- First try user's assigned schedule
  SELECT ws.* INTO v_schedule
  FROM profiles p
  JOIN work_schedules ws ON ws.id = p.schedule_id
  WHERE p.id = p_user_id AND ws.is_active = true;

  IF FOUND THEN
    RETURN v_schedule;
  END IF;

  -- Fall back to default active schedule for the tenant
  SELECT ws.* INTO v_schedule
  FROM work_schedules ws
  WHERE ws.tenant_id = v_user_tenant
    AND ws.is_active = true
  ORDER BY ws.created_at ASC
  LIMIT 1;

  RETURN v_schedule;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: get_expected_hours_for_date
-- Returns expected work hours for a user on a specific date
-- based on their schedule's daily_hours and work days
-- =====================================================
CREATE OR REPLACE FUNCTION get_expected_hours_for_date(p_user_id UUID, p_date DATE)
RETURNS NUMERIC(4,2) AS $$
DECLARE
  v_dow INT;
  v_is_workday BOOLEAN := false;
  v_schedule work_schedules%ROWTYPE;
BEGIN
  v_dow := EXTRACT(DOW FROM p_date); -- 0=Sunday, 1=Monday, ..., 6=Saturday
  v_schedule := get_user_schedule(p_user_id);

  IF v_schedule IS NULL THEN
    -- No schedule found: default 8h Mon-Fri, 0 on weekends
    IF v_dow = 0 OR v_dow = 6 THEN
      RETURN 0;
    END IF;
    RETURN 8.00;
  END IF;

  -- Check if this day of week is a work day for the schedule
  CASE v_dow
    WHEN 0 THEN v_is_workday := COALESCE(v_schedule.sunday, false);
    WHEN 1 THEN v_is_workday := COALESCE(v_schedule.monday, true);
    WHEN 2 THEN v_is_workday := COALESCE(v_schedule.tuesday, true);
    WHEN 3 THEN v_is_workday := COALESCE(v_schedule.wednesday, true);
    WHEN 4 THEN v_is_workday := COALESCE(v_schedule.thursday, true);
    WHEN 5 THEN v_is_workday := COALESCE(v_schedule.friday, true);
    WHEN 6 THEN v_is_workday := COALESCE(v_schedule.saturday, false);
  END CASE;

  IF NOT v_is_workday THEN
    RETURN 0;
  END IF;

  RETURN COALESCE(v_schedule.daily_hours, 8.00);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: get_monthly_expected_hours
-- Returns total expected hours for a user in a given month
-- =====================================================
CREATE OR REPLACE FUNCTION get_monthly_expected_hours(
  p_user_id UUID,
  p_year INT,
  p_month INT
)
RETURNS NUMERIC(6,2) AS $$
DECLARE
  v_schedule work_schedules%ROWTYPE;
  v_total NUMERIC(6,2) := 0;
  v_date DATE;
  v_dow INT;
  v_days_in_month INT;
  v_is_workday BOOLEAN;
BEGIN
  v_schedule := get_user_schedule(p_user_id);
  v_days_in_month := DATE_PART('days', DATE(p_year || '-' || LPAD(p_month::TEXT, 2, '0') || '-01') + INTERVAL '1 month - 1 day');

  FOR d IN 1..v_days_in_month LOOP
    v_date := DATE(p_year || '-' || LPAD(p_month::TEXT, 2, '0') || '-' || LPAD(d::TEXT, 2, '0'));
    v_dow := EXTRACT(DOW FROM v_date);

    CASE v_dow
      WHEN 0 THEN v_is_workday := COALESCE(v_schedule.sunday, false);
      WHEN 1 THEN v_is_workday := COALESCE(v_schedule.monday, true);
      WHEN 2 THEN v_is_workday := COALESCE(v_schedule.tuesday, true);
      WHEN 3 THEN v_is_workday := COALESCE(v_schedule.wednesday, true);
      WHEN 4 THEN v_is_workday := COALESCE(v_schedule.thursday, true);
      WHEN 5 THEN v_is_workday := COALESCE(v_schedule.friday, true);
      WHEN 6 THEN v_is_workday := COALESCE(v_schedule.saturday, false);
    END CASE;

    IF v_is_workday THEN
      v_total := v_total + COALESCE(v_schedule.daily_hours, 8.00);
    END IF;
  END LOOP;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: auto_close_and_calculate_time_entry
-- Called after clock_out to auto-calculate totals using schedule
-- =====================================================
CREATE OR REPLACE FUNCTION auto_close_and_calculate_time_entry(p_entry_id UUID)
RETURNS VOID AS $$
DECLARE
  v_entry RECORD;
  v_totals JSONB;
BEGIN
  SELECT * INTO v_entry FROM time_entries WHERE id = p_entry_id;

  IF v_entry.clock_in IS NULL THEN
    RETURN;
  END IF;

  v_totals := calculate_time_entry_totals(
    v_entry.clock_in,
    v_entry.clock_out,
    v_entry.lunch_start,
    v_entry.lunch_end,
    v_entry.user_id,
    v_entry.date
  );

  UPDATE time_entries
  SET total_hours = (v_totals->>'total_hours')::NUMERIC,
      overtime_hours = (v_totals->>'overtime_hours')::NUMERIC,
      status = CASE WHEN clock_out IS NOT NULL THEN 'closed' ELSE status END,
      updated_at = NOW()
  WHERE id = p_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: recalculate_month_overtime
-- Recalculates overtime for all time entries in a given month
-- =====================================================
CREATE OR REPLACE FUNCTION recalculate_month_overtime(
  p_user_id UUID,
  p_year INT,
  p_month INT
)
RETURNS VOID AS $$
DECLARE
  v_entry RECORD;
  v_totals JSONB;
BEGIN
  FOR v_entry IN
    SELECT te.id, te.date, te.clock_in, te.clock_out, te.lunch_start, te.lunch_end
    FROM time_entries te
    WHERE te.user_id = p_user_id
      AND EXTRACT(YEAR FROM te.date) = p_year
      AND EXTRACT(MONTH FROM te.date) = p_month
  LOOP
    v_totals := calculate_time_entry_totals(
      v_entry.clock_in, v_entry.clock_out,
      v_entry.lunch_start, v_entry.lunch_end,
      p_user_id, v_entry.date
    );

    UPDATE time_entries
    SET total_hours = (v_totals->>'total_hours')::NUMERIC,
        overtime_hours = (v_totals->>'overtime_hours')::NUMERIC,
        updated_at = NOW()
    WHERE id = v_entry.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: calculate_monthly_timesheet_totals
-- Computes and upserts monthly_timesheet from time_entries
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_monthly_timesheet_totals(
  p_user_id UUID,
  p_year INT,
  p_month INT
)
RETURNS VOID AS $$
DECLARE
  v_total_worked NUMERIC(6,2) := 0;
  v_total_overtime NUMERIC(6,2) := 0;
  v_month DATE;
  v_existing_id UUID;
BEGIN
  v_month := DATE(p_year || '-' || LPAD(p_month::TEXT, 2, '0') || '-01');

  -- Sum from time_entries
  SELECT COALESCE(SUM(total_hours), 0), COALESCE(SUM(overtime_hours), 0)
  INTO v_total_worked, v_total_overtime
  FROM time_entries
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month;

  -- Upsert monthly_timesheet
  SELECT id INTO v_existing_id
  FROM monthly_timesheets
  WHERE user_id = p_user_id AND month = v_month;

  IF v_existing_id IS NOT NULL THEN
    UPDATE monthly_timesheets
    SET total_worked_hours = ROUND(v_total_worked::NUMERIC, 2),
        total_overtime_hours = ROUND(v_total_overtime::NUMERIC, 2),
        overtime_pending_approval = ROUND(GREATEST(0, v_total_overtime - approved_overtime_hours)::NUMERIC, 2),
        updated_at = NOW()
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO monthly_timesheets (
      user_id, month, tenant_id,
      total_worked_hours, total_overtime_hours,
      approved_overtime_hours, overtime_pending_approval, status
    )
    VALUES (
      p_user_id, v_month, get_user_tenant(p_user_id),
      ROUND(v_total_worked::NUMERIC, 2),
      ROUND(v_total_overtime::NUMERIC, 2),
      0, ROUND(GREATEST(0, v_total_overtime)::NUMERIC, 2),
      'open'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: get_monthly_timesheet
-- Returns the monthly timesheet for a user
-- =====================================================
CREATE OR REPLACE FUNCTION get_monthly_timesheet(
  p_user_id UUID,
  p_year INT,
  p_month INT
)
RETURNS monthly_timesheets AS $$
DECLARE
  v_month DATE;
BEGIN
  v_month := DATE(p_year || '-' || LPAD(p_month::TEXT, 2, '0') || '-01');

  RETURN QUERY
  SELECT * FROM monthly_timesheets
  WHERE user_id = p_user_id AND month = v_month
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RPC: get_team_timesheets
-- Returns timesheet summaries for all users managed by manager
-- =====================================================
CREATE OR REPLACE FUNCTION get_team_timesheets(
  p_manager_id UUID,
  p_year INT,
  p_month INT
)
RETURNS TABLE(
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
  status TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as user_id,
    p.name as user_name,
    p.department,
    COALESCE(ws.name, 'Sem escala') as schedule_name,
    COALESCE(ws.daily_hours, 8.00) as daily_hours,
    COALESCE(mt.total_worked_hours, 0) as total_worked_hours,
    COALESCE(mt.total_overtime_hours, 0) as total_overtime_hours,
    COALESCE(mt.approved_overtime_hours, 0) as approved_overtime_hours,
    COALESCE(mt.overtime_pending_approval, 0) as overtime_pending_approval,
    get_monthly_expected_hours(p.id, p_year, p_month) as expected_monthly_hours,
    COALESCE(mt.status, 'open') as status,
    mt.approved_by,
    mt.approved_at
  FROM profiles p
  LEFT JOIN work_schedules ws ON ws.id = p.schedule_id
  LEFT JOIN monthly_timesheets mt ON mt.user_id = p.id
    AND mt.month = DATE(p_year || '-' || LPAD(p_month::TEXT, 2, '0') || '-01')
  WHERE p.manager_id = p_manager_id
    AND p.tenant_id = get_user_tenant(p_manager_id)
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SEED DEFAULT WORK SCHEDULE
-- =====================================================
INSERT INTO work_schedules (
  id, tenant_id, name, daily_hours,
  monday, tuesday, wednesday, thursday, friday, saturday, sunday,
  tolerance_minutes, start_work, end_work, lunch_duration_minutes, is_active
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  '8h Padrão CLT',
  8.00,
  true, true, true, true, true, false, false,
  5,
  '09:00', '18:00', 60,
  true
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- UPDATE handle_new_user to assign default schedule
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, vacation_balance, hours_balance, tenant_id, schedule_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'employee',
    30,
    0,
    COALESCE(
      (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1),
      '00000000-0000-0000-0000-000000000000'::uuid
    ),
    '00000000-0000-0000-0000-000000000001'::uuid
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_profiles_schedule_id ON profiles(schedule_id);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department);
