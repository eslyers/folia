-- Migration 009: Add time_entries table for punch clock tracking
-- Records daily clock in/out and lunch breaks

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIME,
  clock_out TIME,
  lunch_start TIME,
  lunch_end TIME,
  total_hours NUMERIC(5,2) DEFAULT 0,
  overtime_hours NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'approved')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- Trigger for updated_at
CREATE TRIGGER time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- RLS for time_entries
-- =====================================================
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Users can view their own entries
CREATE POLICY "tenant_users_view_own_time_entries" ON time_entries
  FOR SELECT USING (
    auth.uid() = user_id
  );

-- Users can insert their own entries (clock actions)
CREATE POLICY "tenant_users_insert_time_entries" ON time_entries
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Users can update their own entries (clock actions)
CREATE POLICY "tenant_users_update_time_entries" ON time_entries
  FOR UPDATE USING (
    auth.uid() = user_id AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Tenant admins can view all entries in their tenant
CREATE POLICY "tenant_admins_view_time_entries" ON time_entries
  FOR SELECT USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Tenant admins can update entries in their tenant
CREATE POLICY "tenant_admins_update_time_entries" ON time_entries
  FOR UPDATE USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Service role can do everything
CREATE POLICY "service_role_time_entries" ON time_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_id ON time_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(status);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, date);

-- =====================================================
-- RPC: calculate_overtime
-- Calculates overtime for a given time entry based on schedule
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_overtime(
  p_entry_id UUID
)
RETURNS NUMERIC(5,2) AS $$
DECLARE
  v_entry RECORD;
  v_profile RECORD;
  v_schedule RECORD;
  v_expected_hours NUMERIC(5,2) DEFAULT 8.0;
  v_work_days BOOLEAN[] DEFAULT ARRAY[false, true, true, true, true, true, false]; -- Sun..Sat
  v_total_hours NUMERIC(5,2) DEFAULT 0;
  v_overtime NUMERIC(5,2) DEFAULT 0;
  v_clock_in_t TIME;
  v_clock_out_t TIME;
  v_lunch_start_t TIME;
  v_lunch_end_t TIME;
BEGIN
  -- Get entry
  SELECT * INTO v_entry FROM time_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Get user profile and schedule
  SELECT p.*, ws.monday_hours, ws.tuesday_hours, ws.wednesday_hours,
         ws.thursday_hours, ws.friday_hours, ws.saturday_hours, ws.sunday_hours,
         ws.tolerance_minutes
  INTO v_profile
  FROM profiles p
  LEFT JOIN work_schedules ws ON p.schedule_id = ws.id
  WHERE p.id = v_entry.user_id;

  -- Calculate expected hours for this day of week
  IF v_entry.date IS NOT NULL THEN
    DECLARE
      v_dow INTEGER := EXTRACT(DOW FROM v_entry.date)::INTEGER;
    BEGIN
      CASE v_dow
        WHEN 0 THEN v_expected_hours := COALESCE(v_profile.sunday_hours, 0);
        WHEN 1 THEN v_expected_hours := COALESCE(v_profile.monday_hours, 8);
        WHEN 2 THEN v_expected_hours := COALESCE(v_profile.tuesday_hours, 8);
        WHEN 3 THEN v_expected_hours := COALESCE(v_profile.wednesday_hours, 8);
        WHEN 4 THEN v_expected_hours := COALESCE(v_profile.thursday_hours, 8);
        WHEN 5 THEN v_expected_hours := COALESCE(v_profile.friday_hours, 8);
        WHEN 6 THEN v_expected_hours := COALESCE(v_profile.saturday_hours, 0);
      END CASE;
    END;
  END IF;

  -- Calculate total hours
  IF v_entry.clock_in IS NOT NULL AND v_entry.clock_out IS NOT NULL THEN
    v_total_hours := EXTRACT(EPOCH FROM (v_entry.clock_out - v_entry.clock_in)) / 3600.0;

    -- Subtract lunch duration
    IF v_entry.lunch_start IS NOT NULL AND v_entry.lunch_end IS NOT NULL THEN
      v_total_hours := v_total_hours - EXTRACT(EPOCH FROM (v_entry.lunch_end - v_entry.lunch_start)) / 3600.0;
    END IF;

    v_total_hours := ROUND(GREATEST(0, v_total_hours)::NUMERIC, 2);
    v_overtime := GREATEST(0, v_total_hours - v_expected_hours);
  END IF;

  RETURN v_overtime;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RPC: get_user_overtime_summary
-- Returns overtime summary for a user for a given month
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_overtime_summary(
  p_user_id UUID,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_month_start DATE := make_date(p_year, p_month, 1);
  v_month_end DATE := v_month_start + INTERVAL '1 month' - INTERVAL '1 day';
  v_expected_hours NUMERIC(6,2);
  v_work_days INTEGER;
  v_schedule RECORD;
  v_profile RECORD;
BEGIN
  -- Get user's schedule
  SELECT p.schedule_id INTO v_profile FROM profiles p WHERE p.id = p_user_id;

  v_expected_hours := 0;
  v_work_days := 0;

  IF v_profile.schedule_id IS NOT NULL THEN
    SELECT * INTO v_schedule FROM work_schedules WHERE id = v_profile.schedule_id;
    IF FOUND THEN
      -- Count work days in month and calculate expected hours
      FOR i IN 0..(v_month_end - v_month_start) LOOP
        DECLARE
          v_date DATE := v_month_start + i;
          v_dow INTEGER := EXTRACT(DOW FROM v_date)::INTEGER;
          v_hours NUMERIC(4,2);
        BEGIN
          CASE v_dow
            WHEN 0 THEN v_hours := COALESCE(v_schedule.sunday_hours, 0);
            WHEN 1 THEN v_hours := COALESCE(v_schedule.monday_hours, 8);
            WHEN 2 THEN v_hours := COALESCE(v_schedule.tuesday_hours, 8);
            WHEN 3 THEN v_hours := COALESCE(v_schedule.wednesday_hours, 8);
            WHEN 4 THEN v_hours := COALESCE(v_schedule.thursday_hours, 8);
            WHEN 5 THEN v_hours := COALESCE(v_schedule.friday_hours, 8);
            WHEN 6 THEN v_hours := COALESCE(v_schedule.saturday_hours, 0);
          END CASE;
          v_expected_hours := v_expected_hours + v_hours;
          IF v_hours > 0 THEN v_work_days := v_work_days + 1; END IF;
        END;
      END LOOP;
    END IF;
  ELSE
    -- Default: 22 work days * 8 hours
    v_work_days := 22;
    v_expected_hours := 176;
  END IF;

  -- Get overtime totals from time_entries
  SELECT
    COALESCE(SUM(total_hours), 0) as total_worked,
    COALESCE(SUM(overtime_hours), 0) as total_overtime
  INTO v_result
  FROM time_entries
  WHERE user_id = p_user_id
    AND date >= v_month_start
    AND date <= v_month_end
    AND status IN ('closed', 'approved');

  RETURN jsonb_build_object(
    'expected_monthly_hours', v_expected_hours,
    'work_days', v_work_days,
    'total_overtime_hours', COALESCE(v_result->>'total_overtime', '0')::NUMERIC,
    'total_worked_hours', COALESCE(v_result->>'total_worked', '0')::NUMERIC
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
