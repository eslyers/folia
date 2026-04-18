-- Migration: Add audit_log table for change tracking
-- Task #7: Histórico de Alterações

-- =====================================================
-- TABLE: audit_log
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'approved', 'rejected', 'cancelled', 'balance_change')),
  table_name TEXT NOT NULL,
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- RLS for audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "admins_view_audit_logs" ON audit_log
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Service role can insert audit logs (from API)
CREATE POLICY "service_insert_audit_logs" ON audit_log
  FOR INSERT WITH CHECK (true);

-- Everyone can insert (for triggers/RPCs)
CREATE POLICY "authenticated_insert_audit_logs" ON audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- RPC: log_audit_action
-- =====================================================
CREATE OR REPLACE FUNCTION log_audit_action(
  p_user_id UUID,
  p_action TEXT,
  p_table_name TEXT,
  p_record_id UUID,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_log (user_id, action, table_name, record_id, old_value, new_value)
  VALUES (p_user_id, p_action, p_table_name, p_record_id, p_old_value, p_new_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;