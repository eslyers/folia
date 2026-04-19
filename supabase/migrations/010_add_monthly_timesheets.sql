-- Migration 010: Add monthly_timesheets table for monthly overtime approval
-- Tracks monthly overtime summaries and approval status per employee

CREATE TABLE IF NOT EXISTS monthly_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- primeiro dia do mês
  total_worked_hours NUMERIC(6,2) DEFAULT 0,
  total_overtime_hours NUMERIC(6,2) DEFAULT 0,
  approved_overtime_hours NUMERIC(6,2) DEFAULT 0,
  overtime_pending_approval NUMERIC(6,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending_approval', 'approved', 'rejected')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_month UNIQUE (user_id, month)
);

-- Trigger for updated_at
CREATE TRIGGER monthly_timesheets_updated_at
  BEFORE UPDATE ON monthly_timesheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- RLS for monthly_timesheets
-- =====================================================
ALTER TABLE monthly_timesheets ENABLE ROW LEVEL SECURITY;

-- Users can view their own timesheets
CREATE POLICY "tenant_users_view_own_timesheets" ON monthly_timesheets
  FOR SELECT USING (
    auth.uid() = user_id
  );

-- Tenant admins can view all timesheets in their tenant
CREATE POLICY "tenant_admins_view_timesheets" ON monthly_timesheets
  FOR SELECT USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Tenant admins can update timesheets in their tenant (approval actions)
CREATE POLICY "tenant_admins_update_timesheets" ON monthly_timesheets
  FOR UPDATE USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Users can insert their own timesheets (self-closing)
CREATE POLICY "tenant_users_insert_timesheets" ON monthly_timesheets
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Service role can do everything
CREATE POLICY "service_role_monthly_timesheets" ON monthly_timesheets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_monthly_timesheets_user_id ON monthly_timesheets(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_timesheets_month ON monthly_timesheets(month);
CREATE INDEX IF NOT EXISTS idx_monthly_timesheets_tenant_id ON monthly_timesheets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monthly_timesheets_status ON monthly_timesheets(status);

-- =====================================================
-- RPC: get_team_timesheet_summary
-- Returns timesheet summary for all users managed by a manager
-- Used by admin/timesheets page
-- =====================================================
CREATE OR REPLACE FUNCTION get_team_timesheet_summary(
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
  schedule_expected AS (
    SELECT
      p.id as user_id,
      COALESCE(ws.name, '8h padrão') as schedule_name,
      COALESCE(
        (EXTRACT(DOW FROM make_date(p_year, p_month, 1))::INTEGER + 7) % 7, -- normalize to Mon=1
        1
      ) as first_dow,
      (
        SELECT SUM(hours) FROM (
          SELECT CASE EXTRACT(DOW FROM d)::INTEGER
            WHEN 0 THEN ws.sunday_hours
            WHEN 1 THEN ws.monday_hours
            WHEN 2 THEN ws.tuesday_hours
            WHEN 3 THEN ws.wednesday_hours
            WHEN 4 THEN ws.thursday_hours
            WHEN 5 THEN ws.friday_hours
            WHEN 6 THEN ws.saturday_hours
          END as hours
          FROM generate_series(
            (SELECT start_date FROM month_range),
            (SELECT end_date FROM month_range),
            '1 day'::INTERVAL
          ) d
        ) hours_calc
        WHERE hours > 0
      ) as expected_monthly_hours,
      (
        SELECT AVG(hours) FROM (
          SELECT CASE EXTRACT(DOW FROM d)::INTEGER
            WHEN 0 THEN ws.sunday_hours
            WHEN 1 THEN ws.monday_hours
            WHEN 2 THEN ws.tuesday_hours
            WHEN 3 THEN ws.wednesday_hours
            WHEN 4 THEN ws.thursday_hours
            WHEN 5 THEN ws.friday_hours
            WHEN 6 THEN ws.saturday_hours
          END as hours
          FROM generate_series(
            (SELECT start_date FROM month_range),
            (SELECT end_date FROM month_range),
            '1 day'::INTERVAL
          ) d
        ) hours_calc
        WHERE hours > 0
      ) as avg_daily_hours
    FROM profiles p
    LEFT JOIN work_schedules ws ON p.schedule_id = ws.id
    WHERE p.manager_id = p_manager_id
      AND p.role = 'employee'
  ),
  timesheet_totals AS (
    SELECT
      te.user_id,
      SUM(te.total_hours) as total_worked_hours,
      SUM(te.overtime_hours) as total_overtime_hours,
      SUM(CASE WHEN te.overtime_hours > 0 AND te.status = 'closed'
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
    se.schedule_name,
    COALESCE(se.avg_daily_hours, 8)::NUMERIC(4,2) as daily_hours,
    COALESCE(tt.total_worked_hours, 0)::NUMERIC(6,2) as total_worked_hours,
    COALESCE(tt.total_overtime_hours, 0)::NUMERIC(6,2) as total_overtime_hours,
    COALESCE(mt.approved_overtime_hours, 0)::NUMERIC(6,2) as approved_overtime_hours,
    COALESCE(tt.overtime_pending, 0)::NUMERIC(6,2) as overtime_pending_approval,
    COALESCE(se.expected_monthly_hours, 176)::NUMERIC(6,2) as expected_monthly_hours,
    COALESCE(mt.status, 'open')::TEXT as status
  FROM profiles p
  LEFT JOIN schedule_expected se ON se.user_id = p.id
  LEFT JOIN timesheet_totals tt ON tt.user_id = p.id
  LEFT JOIN monthly_ts mt ON mt.user_id = p.id
  WHERE p.manager_id = p_manager_id
    AND p.role = 'employee';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RPC: upsert_monthly_timesheet
-- Auto-creates or updates monthly timesheet from time_entries
-- =====================================================
CREATE OR REPLACE FUNCTION upsert_monthly_timesheet(
  p_user_id UUID,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS monthly_timesheets AS $$
DECLARE
  v_month_start DATE := make_date(p_year, p_month, 1);
  v_month_end DATE := v_month_start + INTERVAL '1 month' - INTERVAL '1 day';
  v_profile RECORD;
  v_tenant_id UUID;
  v_total_worked NUMERIC(6,2);
  v_total_overtime NUMERIC(6,2);
  v_pending NUMERIC(6,2);
  v_existing RECORD;
BEGIN
  -- Get tenant_id from profile
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = p_user_id;

  -- Calculate totals from time_entries
  SELECT
    COALESCE(SUM(total_hours), 0),
    COALESCE(SUM(overtime_hours), 0)
  INTO v_total_worked, v_total_overtime
  FROM time_entries
  WHERE user_id = p_user_id
    AND date >= v_month_start
    AND date <= v_month_end
    AND status IN ('closed', 'approved');

  -- Pending = overtime from closed (not yet approved/rejected) entries
  SELECT COALESCE(SUM(overtime_hours), 0)
  INTO v_pending
  FROM time_entries
  WHERE user_id = p_user_id
    AND date >= v_month_start
    AND date <= v_month_end
    AND status = 'closed'
    AND overtime_hours > 0;

  -- Check if timesheet exists
  SELECT * INTO v_existing
  FROM monthly_timesheets
  WHERE user_id = p_user_id AND month = v_month_start;

  IF v_existing.id IS NOT NULL THEN
    -- Update existing (only if status is open)
    IF v_existing.status = 'open' THEN
      UPDATE monthly_timesheets
      SET
        total_worked_hours = v_total_worked,
        total_overtime_hours = v_total_overtime,
        overtime_pending_approval = v_pending,
        updated_at = NOW()
      WHERE id = v_existing.id
      RETURNING * INTO v_existing;
    END IF;
    RETURN v_existing;
  ELSE
    -- Insert new
    INSERT INTO monthly_timesheets (
      tenant_id, user_id, month,
      total_worked_hours, total_overtime_hours,
      overtime_pending_approval, status
    )
    VALUES (
      COALESCE(v_tenant_id, '00000000-0000-0000-0000-000000000000'::UUID),
      p_user_id, v_month_start,
      v_total_worked, v_total_overtime,
      v_pending, 'open'
    )
    RETURNING * INTO v_existing;
    RETURN v_existing;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
