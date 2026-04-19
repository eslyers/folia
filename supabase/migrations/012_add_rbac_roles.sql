-- Migration 012: Multi-Tenant RBAC - Role-Based Access Control
-- Adds 4-tier role system: master_admin | tenant_admin | gestor | funcionario

-- =====================================================
-- UPDATE EXISTING role enum to add new values
-- =====================================================
DO $$ BEGIN
  CREATE TYPE role AS ENUM ('master_admin', 'tenant_admin', 'gestor', 'funcionario', 'admin', 'employee');
EXCEPTION
  WHEN duplicate_object THEN
    -- Add missing values if enum already exists
    ALTER TYPE role ADD VALUE IF NOT EXISTS 'master_admin';
    ALTER TYPE role ADD VALUE IF NOT EXISTS 'tenant_admin';
    ALTER TYPE role ADD VALUE IF NOT EXISTS 'gestor';
    ALTER TYPE role ADD VALUE IF NOT EXISTS 'funcionario';
END $$;

-- =====================================================
-- ADD COLUMNS TO profiles if not exist
-- =====================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =====================================================
-- HELPER FUNCTION: is_master_admin
-- Checks if user is master_admin (SaaS-level admin)
-- =====================================================
CREATE OR REPLACE FUNCTION is_master_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role = 'master_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: is_tenant_admin
-- Checks if user is tenant_admin or master_admin for a given tenant
-- =====================================================
CREATE OR REPLACE FUNCTION is_tenant_admin(user_id UUID, tenant_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles 
    WHERE id = user_id 
      AND role IN ('master_admin', 'tenant_admin')
      AND tenant_id = tenant_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: is_manager_of
-- Checks if manager_id is the manager of employee_id
-- =====================================================
CREATE OR REPLACE FUNCTION is_manager_of(manager_id UUID, employee_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles 
    WHERE id = employee_id AND manager_id = manager_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: get_user_tenant (updated)
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_tenant(p_user_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT tenant_id FROM profiles WHERE id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: get_user_role
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM profiles WHERE id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: can_access_tenant_data
-- Master admin sees all. Tenant admin/gestor/employee sees only own tenant.
-- =====================================================
CREATE OR REPLACE FUNCTION can_access_tenant_data(p_user_id UUID, p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Master admin sees all tenants
  IF is_master_admin(p_user_id) THEN RETURN true; END IF;
  -- Others see only their tenant
  RETURN get_user_tenant(p_user_id) = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: can_manage_employee
-- Returns true if the user can manage target employee
-- =====================================================
CREATE OR REPLACE FUNCTION can_manage_employee(p_manager_id UUID, p_employee_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM profiles 
    WHERE id = p_employee_id AND manager_id = p_manager_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- DROP OLD POLICIES (replace with new RBAC policies)
-- =====================================================
DROP POLICY IF EXISTS "tenant_users_view_profiles" ON profiles;
DROP POLICY IF EXISTS "tenant_users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "tenant_admins_insert_profiles" ON profiles;
DROP POLICY IF EXISTS "tenant_admins_update_profiles" ON profiles;

DROP POLICY IF EXISTS "tenant_users_view_own_requests" ON leave_requests;
DROP POLICY IF EXISTS "tenant_admins_view_requests" ON leave_requests;
DROP POLICY IF EXISTS "tenant_users_create_requests" ON leave_requests;
DROP POLICY IF EXISTS "tenant_admins_update_requests" ON leave_requests;
DROP POLICY IF EXISTS "tenant_users_cancel_own_requests" ON leave_requests;

DROP POLICY IF EXISTS "tenant_users_view_notifications" ON notifications;
DROP POLICY IF EXISTS "tenant_users_update_notifications" ON notifications;

DROP POLICY IF EXISTS "tenant_users_view_hour_entries" ON hour_entries;
DROP POLICY IF EXISTS "tenant_users_insert_hour_entries" ON hour_entries;
DROP POLICY IF EXISTS "tenant_admins_view_hour_entries" ON hour_entries;
DROP POLICY IF EXISTS "tenant_admins_insert_hour_entries" ON hour_entries;

DROP POLICY IF EXISTS "tenant_everyone_view_active_policies" ON policies;
DROP POLICY IF EXISTS "tenant_admins_manage_policies" ON policies;

DROP POLICY IF EXISTS "tenant_admins_view_audit_logs" ON audit_log;
DROP POLICY IF EXISTS "service_role_audit_logs" ON audit_log;
DROP POLICY IF EXISTS "service_insert_audit_logs" ON audit_log;

-- =====================================================
-- PROFILES RLS POLICIES
-- =====================================================

-- Master admin: full access to all profiles
CREATE POLICY "rbac_master_admin_profiles" ON profiles
  FOR ALL USING (is_master_admin(auth.uid()) = true);

-- Tenant admin / master admin: full access within their tenant
CREATE POLICY "rbac_tenant_admin_profiles" ON profiles
  FOR ALL USING (
    is_tenant_admin(auth.uid(), tenant_id) = true
    OR id = auth.uid()
  );

-- Gestor: can view team members and their data
CREATE POLICY "rbac_gestor_view_profiles" ON profiles
  FOR SELECT USING (
    is_manager_of(auth.uid(), id) = true
    OR id = auth.uid()
  );

-- Funcionario / employee: can only view/edit own profile
CREATE POLICY "rbac_employee_profiles" ON profiles
  FOR SELECT USING (id = auth.uid());

-- =====================================================
-- LEAVE_REQUESTS RLS POLICIES
-- =====================================================

-- Master admin: full access
CREATE POLICY "rbac_master_admin_requests" ON leave_requests
  FOR ALL USING (is_master_admin(auth.uid()) = true);

-- Tenant admin / master admin: full access within their tenant
CREATE POLICY "rbac_tenant_admin_requests" ON leave_requests
  FOR ALL USING (
    is_tenant_admin(auth.uid(), tenant_id) = true
    OR user_id = auth.uid()
  );

-- Gestor: can view/approve team requests
CREATE POLICY "rbac_gestor_requests" ON leave_requests
  FOR ALL USING (
    is_manager_of(auth.uid(), user_id) = true
    OR user_id = auth.uid()
  );

-- Funcionario: can only manage own requests
CREATE POLICY "rbac_employee_requests" ON leave_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "rbac_employee_insert_requests" ON leave_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- =====================================================
-- TIME_ENTRIES RLS POLICIES
-- =====================================================

-- Master admin: full access
CREATE POLICY "rbac_master_admin_time" ON time_entries
  FOR ALL USING (is_master_admin(auth.uid()) = true);

-- Tenant admin / master admin: full access within their tenant
CREATE POLICY "rbac_tenant_admin_time" ON time_entries
  FOR ALL USING (
    is_tenant_admin(auth.uid(), tenant_id) = true
    OR user_id = auth.uid()
  );

-- Gestor: can view team time entries
CREATE POLICY "rbac_gestor_time" ON time_entries
  FOR SELECT USING (
    is_manager_of(auth.uid(), user_id) = true
    OR user_id = auth.uid()
  );

CREATE POLICY "rbac_gestor_time_insert" ON time_entries
  FOR INSERT WITH CHECK (
    is_manager_of(auth.uid(), user_id) = true
    OR user_id = auth.uid()
  );

-- Funcionario: can only manage own time entries
CREATE POLICY "rbac_employee_time" ON time_entries
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- NOTIFICATIONS RLS POLICIES
-- =====================================================

-- Users can only view/update their own notifications
CREATE POLICY "rbac_user_notifications" ON notifications
  FOR SELECT USING (
    auth.uid() = user_id AND get_user_tenant(auth.uid()) = tenant_id
  );

CREATE POLICY "rbac_user_update_notifications" ON notifications
  FOR UPDATE USING (
    auth.uid() = user_id AND get_user_tenant(auth.uid()) = tenant_id
  );

-- =====================================================
-- POLICIES TABLE RLS
-- =====================================================

CREATE POLICY "rbac_view_policies" ON policies
  FOR SELECT USING (
    is_master_admin(auth.uid()) = true
    OR get_user_tenant(auth.uid()) = tenant_id
  );

CREATE POLICY "rbac_manage_policies" ON policies
  FOR ALL USING (
    is_tenant_admin(auth.uid(), tenant_id) = true
    OR is_master_admin(auth.uid()) = true
  );

-- =====================================================
-- AUDIT_LOG RLS
-- =====================================================

CREATE POLICY "rbac_audit_view" ON audit_log
  FOR SELECT USING (
    is_master_admin(auth.uid()) = true
    OR (is_tenant_admin(auth.uid(), tenant_id) = true AND get_user_tenant(auth.uid()) = tenant_id)
  );

-- =====================================================
-- SERVICE ROLE FULL ACCESS
-- =====================================================
CREATE POLICY "service_role_profiles" ON profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_requests" ON leave_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_time_entries" ON time_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_notifications" ON notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_policies" ON policies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_audit" ON audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- MIGRATE OLD ROLES to new role names
-- =====================================================
-- Map old 'admin' to 'tenant_admin' (existing admin users become tenant admins)
UPDATE profiles SET role = 'tenant_admin' WHERE role = 'admin';

-- Map old 'employee' to 'funcionario' (existing employees become funcionarios)
UPDATE profiles SET role = 'funcionario' WHERE role = 'employee';

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

-- =====================================================
-- SEED: Create master_admin user
-- Note: Run this manually or via a separate seed migration
-- INSERT INTO profiles (id, email, name, role, tenant_id, vacation_balance, hours_balance, is_active)
-- VALUES ('your-user-id', 'master@folia.com', 'Master Admin', 'master_admin', '00000000-0000-0000-0000-000000000000', 30, 0, true);
