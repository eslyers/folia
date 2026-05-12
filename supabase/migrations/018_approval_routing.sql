-- Migration 018: Approval Routing
-- Rule: Requests go to direct manager (gestor). Fallback: tenant_admin.
-- No multi-layer chain — either the manager OR the tenant admin approves.

-- =====================================================
-- Add assigned_approver_id to leave_requests
-- Tracks who should receive/approve this specific request
-- =====================================================
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS assigned_approver_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leave_requests_assigned_approver ON leave_requests(assigned_approver_id);

-- =====================================================
-- FUNCTION: get_approver_for_user
-- Returns the approver UUID for a given employee:
--   1. If employee has a manager_id → return manager_id
--   2. Else → return first active tenant_admin for their tenant
--   3. Else → return NULL (only happens on misconfigured tenants)
-- =====================================================
CREATE OR REPLACE FUNCTION get_approver_for_user(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_manager_id UUID;
  v_tenant_id  UUID;
  v_admin_id   UUID;
BEGIN
  -- Step 1: check for direct manager
  SELECT manager_id, tenant_id
    INTO v_manager_id, v_tenant_id
    FROM profiles
   WHERE id = p_user_id;

  IF v_manager_id IS NOT NULL THEN
    RETURN v_manager_id;
  END IF;

  -- Step 2: fallback to tenant_admin of the same tenant
  SELECT id INTO v_admin_id
    FROM profiles
   WHERE tenant_id = v_tenant_id
     AND role IN ('tenant_admin', 'master_admin')
     AND is_active = true
   ORDER BY
     CASE role WHEN 'tenant_admin' THEN 0 ELSE 1 END  -- prefer tenant_admin over master_admin
   LIMIT 1;

  RETURN v_admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- FUNCTION: assign_approver_on_insert
-- Trigger: auto-populate assigned_approver_id when a new leave request is created
-- =====================================================
CREATE OR REPLACE FUNCTION assign_approver_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set if not already provided and status is pending
  IF NEW.assigned_approver_id IS NULL AND NEW.status = 'pending' THEN
    NEW.assigned_approver_id := get_approver_for_user(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_assign_approver ON leave_requests;
CREATE TRIGGER trg_assign_approver
  BEFORE INSERT ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION assign_approver_on_insert();

-- =====================================================
-- Backfill existing pending requests
-- =====================================================
UPDATE leave_requests lr
   SET assigned_approver_id = get_approver_for_user(lr.user_id)
 WHERE lr.status = 'pending'
   AND lr.assigned_approver_id IS NULL;
