-- Migration 017: Tenant cascade deletion + logo_url column
-- Ensures tenant deletion cleans up all related data

-- Add logo_url to tenants if missing
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- =====================================================
-- CASCADE: When a tenant is deleted, clean up all data
-- Using trigger instead of FK cascade (avoids circular deps)
-- =====================================================
CREATE OR REPLACE FUNCTION handle_tenant_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent deleting the default tenant
  IF OLD.id = '00000000-0000-0000-0000-000000000000'::UUID THEN
    RAISE EXCEPTION 'Cannot delete the default tenant';
  END IF;

  -- Delete leave requests for tenant users (before profiles)
  DELETE FROM leave_requests
  WHERE user_id IN (SELECT id FROM profiles WHERE tenant_id = OLD.id);

  -- Delete time entries
  DELETE FROM time_entries WHERE tenant_id = OLD.id;

  -- Delete notifications for tenant users
  DELETE FROM notifications
  WHERE user_id IN (SELECT id FROM profiles WHERE tenant_id = OLD.id);

  -- Delete hour entries
  DELETE FROM hour_entries
  WHERE user_id IN (SELECT id FROM profiles WHERE tenant_id = OLD.id);

  -- Delete audit logs for tenant
  DELETE FROM audit_log WHERE tenant_id = OLD.id;

  -- Delete system logs for tenant
  DELETE FROM system_logs WHERE tenant_id = OLD.id;

  -- Delete work schedules for tenant
  DELETE FROM work_schedules WHERE tenant_id = OLD.id;

  -- Delete policies for tenant
  DELETE FROM policies WHERE tenant_id = OLD.id;

  -- Finally delete profiles (auth.users kept — they can be reassigned)
  UPDATE profiles SET tenant_id = '00000000-0000-0000-0000-000000000000'::UUID
  WHERE tenant_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_tenant_delete ON tenants;
CREATE TRIGGER before_tenant_delete
  BEFORE DELETE ON tenants
  FOR EACH ROW EXECUTE FUNCTION handle_tenant_deletion();

-- =====================================================
-- Fix: notification_logs should be tenant-isolated
-- Add tenant_id if not present
-- =====================================================
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- =====================================================
-- Fix: system_logs FK to tenants
-- =====================================================
DO $$ BEGIN
  ALTER TABLE system_logs
    ADD CONSTRAINT fk_system_logs_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- Fix: audit_log — add tenant_id if missing
-- =====================================================
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant_id ON notification_logs(tenant_id);
