-- Migration 007: Add tenant_id to all main tables
-- This enables multi-tenant data isolation

-- =====================================================
-- ADD TENANT_ID TO PROFILES
-- =====================================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';

-- =====================================================
-- ADD TENANT_ID TO LEAVE_REQUESTS
-- =====================================================
ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';

-- =====================================================
-- ADD TENANT_ID TO POLICIES
-- =====================================================
ALTER TABLE policies
ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';

-- =====================================================
-- ADD TENANT_ID TO HOUR_ENTRIES
-- =====================================================
ALTER TABLE hour_entries
ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';

-- =====================================================
-- ADD TENANT_ID TO AUDIT_LOG
-- =====================================================
ALTER TABLE audit_log
ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';

-- =====================================================
-- ADD TENANT_ID TO NOTIFICATIONS
-- =====================================================
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';

-- =====================================================
-- ADD TENANT_ID TO NOTIFICATION_LOGS
-- =====================================================
ALTER TABLE notification_logs
ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';

-- =====================================================
-- ADD FOREIGN KEYS (non-blocking, just documented)
-- We use triggers instead of FK constraints for flexibility
-- =====================================================

-- =====================================================
-- HELPER FUNCTION: get_user_tenant
-- Gets the tenant_id for a given user (used in RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_tenant(p_user_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT tenant_id FROM profiles WHERE id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: is_tenant_admin
-- Checks if user is admin within their tenant
-- =====================================================
CREATE OR REPLACE FUNCTION is_tenant_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_user_id 
      AND role = 'admin'
      AND is_tenant_active(tenant_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: is_tenant_active
-- Checks if a tenant is active
-- =====================================================
CREATE OR REPLACE FUNCTION is_tenant_active(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenants 
    WHERE id = p_tenant_id 
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RESTORE UPDATED_AT TRIGGER (was likely dropped)
-- =====================================================
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS leave_requests_updated_at ON leave_requests;
CREATE TRIGGER leave_requests_updated_at
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS policies_updated_at ON policies;
CREATE TRIGGER policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS hour_entries_updated_at ON hour_entries;
CREATE TRIGGER hour_entries_updated_at
  BEFORE INSERT ON hour_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- UPDATE RLS POLICIES FOR MULTI-TENANT ISOLATION
-- =====================================================

-- Drop old policies that don't account for tenant_id
DROP POLICY IF EXISTS "users_view_own_profile" ON profiles;
DROP POLICY IF EXISTS "admins_view_all_profiles" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "admins_insert_profiles" ON profiles;

DROP POLICY IF EXISTS "users_view_own_requests" ON leave_requests;
DROP POLICY IF EXISTS "admins_view_all_requests" ON leave_requests;
DROP POLICY IF EXISTS "users_create_own_requests" ON leave_requests;
DROP POLICY IF EXISTS "admins_update_all_requests" ON leave_requests;
DROP POLICY IF EXISTS "users_cancel_own_pending_requests" ON leave_requests;

DROP POLICY IF EXISTS "users_view_own_notifications" ON notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON notifications;

DROP POLICY IF EXISTS "users_view_own_hour_entries" ON hour_entries;
DROP POLICY IF EXISTS "users_insert_own_hour_entries" ON hour_entries;
DROP POLICY IF EXISTS "admins_view_all_hour_entries" ON hour_entries;
DROP POLICY IF EXISTS "admins_insert_hour_entries" ON hour_entries;

-- === PROFILES POLICIES ===
-- Users can view profiles within their tenant
CREATE POLICY "tenant_users_view_profiles" ON profiles
  FOR SELECT USING (
    get_user_tenant(auth.uid()) = tenant_id
  );

-- Users can update their own profile within their tenant
CREATE POLICY "tenant_users_update_own_profile" ON profiles
  FOR UPDATE USING (
    auth.uid() = id AND get_user_tenant(auth.uid()) = tenant_id
  ) WITH CHECK (
    role = OLD.role -- Cannot change own role
  );

-- Only tenant admins can insert new profiles
CREATE POLICY "tenant_admins_insert_profiles" ON profiles
  FOR INSERT WITH CHECK (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Tenant admins can update profiles within their tenant
CREATE POLICY "tenant_admins_update_profiles" ON profiles
  FOR UPDATE USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- === LEAVE_REQUESTS POLICIES ===
-- Users can view their own requests
CREATE POLICY "tenant_users_view_own_requests" ON leave_requests
  FOR SELECT USING (
    auth.uid() = user_id
  );

-- Tenant admins can view all requests in their tenant
CREATE POLICY "tenant_admins_view_requests" ON leave_requests
  FOR SELECT USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Users can create requests in their tenant
CREATE POLICY "tenant_users_create_requests" ON leave_requests
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Tenant admins can update requests in their tenant
CREATE POLICY "tenant_admins_update_requests" ON leave_requests
  FOR UPDATE USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Users can cancel their own pending requests
CREATE POLICY "tenant_users_cancel_own_requests" ON leave_requests
  FOR UPDATE USING (
    auth.uid() = user_id AND status = 'pending'
  ) WITH CHECK (
    status = 'cancelled'
  );

-- === NOTIFICATIONS POLICIES ===
CREATE POLICY "tenant_users_view_notifications" ON notifications
  FOR SELECT USING (
    auth.uid() = user_id AND get_user_tenant(auth.uid()) = tenant_id
  );

CREATE POLICY "tenant_users_update_notifications" ON notifications
  FOR UPDATE USING (
    auth.uid() = user_id AND get_user_tenant(auth.uid()) = tenant_id
  );

-- === HOUR_ENTRIES POLICIES ===
CREATE POLICY "tenant_users_view_hour_entries" ON hour_entries
  FOR SELECT USING (
    auth.uid() = user_id
  );

CREATE POLICY "tenant_users_insert_hour_entries" ON hour_entries
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND get_user_tenant(auth.uid()) = tenant_id
  );

CREATE POLICY "tenant_admins_view_hour_entries" ON hour_entries
  FOR SELECT USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

CREATE POLICY "tenant_admins_insert_hour_entries" ON hour_entries
  FOR INSERT WITH CHECK (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- === POLICIES TABLE (per-tenant) ===
CREATE POLICY "tenant_everyone_view_active_policies" ON policies
  FOR SELECT USING (
    is_active = true AND get_user_tenant(auth.uid()) = tenant_id
  );

CREATE POLICY "tenant_admins_manage_policies" ON policies
  FOR ALL USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- === AUDIT_LOG (tenant-scoped for admins, all for service role) ===
CREATE POLICY "tenant_admins_view_audit_logs" ON audit_log
  FOR SELECT USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Service role can see everything for audit
CREATE POLICY "service_role_audit_logs" ON audit_log
  FOR SELECT TO service_role USING (true);

CREATE POLICY "service_insert_audit_logs" ON audit_log
  FOR INSERT WITH CHECK (true);

-- === NOTIFICATION_LOGS (tenant-scoped) ===
DROP POLICY IF EXISTS "Allow authenticated users to view notification_logs" ON notification_logs;
DROP POLICY IF EXISTS "Allow authenticated users to insert notification_logs" ON notification_logs;
DROP POLICY IF EXISTS "Service role full access to notification_logs" ON notification_logs;

CREATE POLICY "tenant_users_view_notification_logs" ON notification_logs
  FOR SELECT USING (
    auth.uid() = user_id AND get_user_tenant(auth.uid()) = tenant_id
  );

CREATE POLICY "tenant_users_insert_notification_logs" ON notification_logs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND get_user_tenant(auth.uid()) = tenant_id
  );

CREATE POLICY "service_role_notification_logs" ON notification_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- UPDATE is_admin() function to use new RLS
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- UPDATE handle_new_user trigger to assign tenant
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, vacation_balance, hours_balance, tenant_id)
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
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- UPDATE log_audit_action to include tenant_id
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
  INSERT INTO audit_log (user_id, action, table_name, record_id, old_value, new_value, tenant_id)
  VALUES (
    p_user_id, 
    p_action, 
    p_table_name, 
    p_record_id, 
    p_old_value, 
    p_new_value,
    get_user_tenant(p_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SEED DEFAULT POLICY for the default tenant
-- =====================================================
INSERT INTO policies (name, vacation_days_per_year, carry_over_days, max_consecutive_days, min_days_notice, tenant_id)
VALUES (
  'Política Padrão CLT',
  30,
  5,
  30,
  7,
  '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- UPDATE EXISTING RECORDS to default tenant
-- (only for records that have NULL tenant_id)
-- =====================================================
UPDATE profiles SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE leave_requests SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE policies SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE hour_entries SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE audit_log SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE notifications SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE notification_logs SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;

-- Set NOT NULL constraints after data is migrated
ALTER TABLE profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE leave_requests ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE policies ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE hour_entries ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audit_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE notification_logs ALTER COLUMN tenant_id SET NOT NULL;

-- =====================================================
-- INDEXES FOR TENANT QUERIES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant_id ON leave_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_tenant_id ON policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hour_entries_tenant_id ON hour_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant_id ON notification_logs(tenant_id);
