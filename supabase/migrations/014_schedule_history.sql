-- Migration: 014_schedule_history
-- Purpose: Track schedule assignment history for proper time tracking

CREATE TABLE IF NOT EXISTS schedule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES work_schedules(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  reason TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_schedule_history_user_id ON schedule_history(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_history_tenant_id ON schedule_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedule_history_effective ON schedule_history(user_id, effective_from, effective_to);

-- Function to get the schedule that was active on a specific date for a user
CREATE OR REPLACE FUNCTION get_user_schedule_at_date(p_user_id UUID, p_date DATE)
RETURNS UUID AS $$
DECLARE
  v_schedule_id UUID;
BEGIN
  SELECT schedule_id INTO v_schedule_id
  FROM schedule_history
  WHERE user_id = p_user_id
    AND effective_from <= p_date
    AND (effective_to IS NULL OR effective_to >= p_date)
  ORDER BY effective_from DESC
  LIMIT 1;
  
  RETURN v_schedule_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to assign a new schedule to a user (creates history record and updates profile)
CREATE OR REPLACE FUNCTION assign_user_schedule(
  p_user_id UUID,
  p_schedule_id UUID,
  p_effective_from DATE,
  p_reason TEXT DEFAULT NULL
)
RETURNS schedule_history AS $$
DECLARE
  v_tenant_id UUID;
  v_admin_id UUID;
  v_record schedule_history;
BEGIN
  -- Get tenant_id from user profile
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = p_user_id;
  
  -- Close any existing open assignment
  UPDATE schedule_history
  SET effective_to = p_effective_from - INTERVAL '1 day'
  WHERE user_id = p_user_id
    AND effective_to IS NULL
    AND effective_from <= p_effective_from;
  
  -- Create new history record
  INSERT INTO schedule_history (tenant_id, user_id, schedule_id, effective_from, created_by, reason)
  VALUES (v_tenant_id, p_user_id, p_schedule_id, p_effective_from, auth.uid(), p_reason)
  RETURNING * INTO v_record;
  
  -- Update profile with new current schedule
  UPDATE profiles SET schedule_id = p_schedule_id WHERE id = p_user_id;
  
  RETURN v_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for schedule_history
ALTER TABLE schedule_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own schedule history" ON schedule_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage schedule history for their tenant" ON schedule_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tenant_id = schedule_history.tenant_id
      AND profiles.role IN ('admin', 'tenant_admin', 'master_admin')
    )
  );
