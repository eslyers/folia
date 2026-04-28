-- FOLIA - Sistema de Controle de Férias e Folgas
-- Supabase Schema Migration v1.4 (FIX: added tenants table + tenant_id in profiles)

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- NEW TABLE: tenants (MULTI-TENANT SUPPORT)
-- =====================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view tenants
CREATE POLICY "authenticated_users_can_view_tenants" ON tenants
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to create tenants
CREATE POLICY "authenticated_users_can_create_tenants" ON tenants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow service role full access
CREATE POLICY "service_role_all_tenants" ON tenants
  FOR ALL USING (auth.role() = 'service_role');

-- Seed default tenant (will be used for single-tenant mode)
INSERT INTO tenants (id, name, domain, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Magna Inc.', 'magna.com', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- TABLE 1: profiles (extensão do auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee', 'tenant_admin', 'master_admin')),
  avatar_url TEXT,
  vacation_balance INTEGER NOT NULL DEFAULT 30,
  hours_balance INTEGER NOT NULL DEFAULT 0,
  department TEXT,
  position TEXT,
  phone TEXT,
  emergency_contact TEXT,
  hire_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE 2: leave_requests
-- =====================================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('vacation', 'day_off', 'hours', 'sick', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  hours_count INTEGER DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_days CHECK (days_count > 0)
);

-- =====================================================
-- TABLE 3: policies
-- =====================================================
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vacation_days_per_year INTEGER NOT NULL DEFAULT 30,
  carry_over_days INTEGER NOT NULL DEFAULT 5,
  max_consecutive_days INTEGER NOT NULL DEFAULT 30,
  min_days_notice INTEGER NOT NULL DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE 4: notifications
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification Logs Table
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  message TEXT NOT NULL,
  email_sent BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for notification_logs
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Policy: anyone authenticated can view notification logs
CREATE POLICY "Allow authenticated users to view notification_logs"
  ON notification_logs FOR SELECT
  TO authenticated
  USING (true);

-- Policy: anyone authenticated can insert notification logs
CREATE POLICY "Allow authenticated users to insert notification_logs"
  ON notification_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: service role can do anything (for API routes)
CREATE POLICY "Service role full access to notification_logs"
  ON notification_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER leave_requests_updated_at
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin role (avoids recursion by using SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role IN ('admin', 'master_admin', 'tenant_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user tenant
CREATE OR REPLACE FUNCTION public.get_user_tenant(user_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT tenant_id FROM profiles WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- === PROFILES ===
-- Users can view their own profile
CREATE POLICY "users_view_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin view all within tenant
CREATE POLICY "admins_view_all_profiles" ON profiles
  FOR SELECT USING (
    public.is_admin(auth.uid()) 
    AND tenant_id = public.get_user_tenant(auth.uid())
  );

-- Users can update their own profile (except role)
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (role = OLD.role AND tenant_id = OLD.tenant_id);

-- Admins can insert profiles within their tenant
CREATE POLICY "admins_insert_profiles" ON profiles
  FOR INSERT WITH CHECK (
    public.is_admin(auth.uid())
    AND tenant_id = public.get_user_tenant(auth.uid())
  );

-- === LEAVE REQUESTS ===
-- Users can view their own requests
CREATE POLICY "users_view_own_requests" ON leave_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all requests within tenant
CREATE POLICY "admins_view_all_requests" ON leave_requests
  FOR SELECT USING (
    public.is_admin(auth.uid())
    AND user_id IN (SELECT id FROM profiles WHERE tenant_id = public.get_user_tenant(auth.uid()))
  );

-- Users can create their own requests
CREATE POLICY "users_create_own_requests" ON leave_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can update all requests within tenant
CREATE POLICY "admins_update_all_requests" ON leave_requests
  FOR UPDATE USING (
    public.is_admin(auth.uid())
    AND user_id IN (SELECT id FROM profiles WHERE tenant_id = public.get_user_tenant(auth.uid()))
  );

-- Users can cancel their own pending requests
CREATE POLICY "users_cancel_own_pending_requests" ON leave_requests
  FOR UPDATE USING (
    auth.uid() = user_id AND status = 'pending'
  )
  WITH CHECK (status = 'cancelled');

-- === NOTIFICATIONS ===
CREATE POLICY "users_view_own_notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- === POLICIES ===
CREATE POLICY "everyone_view_active_policies" ON policies
  FOR SELECT USING (is_active = true);

-- =====================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, tenant_id, email, name, role, vacation_balance, hours_balance)
  VALUES (
    NEW.id,
    '00000000-0000-0000-0000-000000000001', -- default tenant
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'employee',
    30,
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- SEED DEFAULT POLICY
-- =====================================================
INSERT INTO policies (name, vacation_days_per_year, carry_over_days, max_consecutive_days, min_days_notice)
VALUES ('Política Padrão CLT', 30, 5, 30, 7)
ON CONFLICT DO NOTHING;

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);

-- =====================================================
-- TABLE 5: hour_entries
-- =====================================================
CREATE TABLE IF NOT EXISTS hour_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('extra', 'compensated')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for hour_entries
CREATE INDEX IF NOT EXISTS idx_hour_entries_user_id ON hour_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_hour_entries_date ON hour_entries(date);

-- Trigger for hour_entries updated_at
CREATE TRIGGER hour_entries_updated_at
  BEFORE INSERT ON hour_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for hour_entries
ALTER TABLE hour_entries ENABLE ROW LEVEL SECURITY;

-- Users can view their own hour entries
CREATE POLICY "users_view_own_hour_entries" ON hour_entries
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own hour entries
CREATE POLICY "users_insert_own_hour_entries" ON hour_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all hour entries within tenant
CREATE POLICY "admins_view_all_hour_entries" ON hour_entries
  FOR SELECT USING (
    public.is_admin(auth.uid())
    AND user_id IN (SELECT id FROM profiles WHERE tenant_id = public.get_user_tenant(auth.uid()))
  );

-- Admins can insert hour entries for any user within tenant
CREATE POLICY "admins_insert_hour_entries" ON hour_entries
  FOR INSERT WITH CHECK (
    public.is_admin(auth.uid())
    AND user_id IN (SELECT id FROM profiles WHERE tenant_id = public.get_user_tenant(auth.uid()))
  );

-- =====================================================
-- TABLE 6: audit_log
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'approved', 'rejected', 'cancelled', 'balance_change')),
  table_name TEXT NOT NULL,
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs within tenant
CREATE POLICY "admins_view_audit_logs" ON audit_log
  FOR SELECT USING (
    public.is_admin(auth.uid())
    AND (tenant_id = public.get_user_tenant(auth.uid()) OR tenant_id IS NULL)
  );

-- Service role can insert
CREATE POLICY "service_insert_audit_logs" ON audit_log
  FOR INSERT WITH CHECK (true);

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
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Get tenant from user
  v_tenant_id := public.get_user_tenant(p_user_id);
  
  INSERT INTO audit_log (user_id, tenant_id, action, table_name, record_id, old_value, new_value)
  VALUES (p_user_id, v_tenant_id, p_action, p_table_name, p_record_id, p_old_value, p_new_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RPC FUNCTIONS
-- =====================================================

-- C2: Atomic vacation balance deduction with race condition protection
CREATE OR REPLACE FUNCTION deduct_vacation_balance(
  p_user_id UUID,
  p_days INTEGER,
  p_expected_balance INTEGER
)
RETURNS VOID AS $$
BEGIN
  -- Atomic update: only deduct if balance matches expected (no concurrent modification)
  UPDATE profiles
  SET vacation_balance = vacation_balance - p_days
  WHERE id = p_user_id
    AND vacation_balance = p_expected_balance;
  
  -- Check if update succeeded (row count = 0 means balance changed)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Balance modified concurrently';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- C3: Atomic hours balance deduction with race condition protection
CREATE OR REPLACE FUNCTION deduct_hours_balance(
  p_user_id UUID,
  p_minutes INTEGER,
  p_expected_balance INTEGER
)
RETURNS VOID AS $$
BEGIN
  -- Atomic update: only deduct if balance matches expected (no concurrent modification)
  UPDATE profiles
  SET hours_balance = hours_balance - p_minutes
  WHERE id = p_user_id
    AND hours_balance = p_expected_balance;
  
  -- Check if update succeeded (row count = 0 means balance changed)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hours balance modified concurrently';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- C4: Add hours to balance (for extra hours worked)
CREATE OR REPLACE FUNCTION add_hours_balance(
  p_user_id UUID,
  p_minutes INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET hours_balance = hours_balance + p_minutes
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TABLE: work_schedules (FIXED: tenant_id now references tenants)
-- =====================================================
CREATE TABLE IF NOT EXISTS work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  daily_hours INTEGER NOT NULL DEFAULT 8,
  monday BOOLEAN NOT NULL DEFAULT true,
  tuesday BOOLEAN NOT NULL DEFAULT true,
  wednesday BOOLEAN NOT NULL DEFAULT true,
  thursday BOOLEAN NOT NULL DEFAULT true,
  friday BOOLEAN NOT NULL DEFAULT true,
  saturday BOOLEAN NOT NULL DEFAULT false,
  sunday BOOLEAN NOT NULL DEFAULT false,
  tolerance_minutes INTEGER NOT NULL DEFAULT 5,
  start_work TEXT NOT NULL DEFAULT '09:00',
  end_work TEXT NOT NULL DEFAULT '18:00',
  lunch_duration_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for work_schedules
CREATE POLICY "Users can view schedules from their tenant" ON work_schedules
  FOR SELECT USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Tenant admins can manage schedules" ON work_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('tenant_admin', 'master_admin')
      AND profiles.tenant_id = work_schedules.tenant_id
    )
  );

-- =====================================================
-- TABLE: schedule_assignments (junction table)
-- =====================================================
CREATE TABLE IF NOT EXISTS schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES work_schedules(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, effective_date)
);

-- Enable RLS
ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their assignments" ON schedule_assignments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Tenant admins can manage assignments" ON schedule_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('tenant_admin', 'master_admin')
    )
  );

-- =====================================================
-- TABLE: time_entries (FIXED: tenant_id now references tenants)
-- =====================================================
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMP WITH TIME ZONE,
  clock_out TIMESTAMP WITH TIME ZONE,
  lunch_start TIMESTAMP WITH TIME ZONE,
  lunch_end TIMESTAMP WITH TIME ZONE,
  total_hours NUMERIC(5,2),
  overtime_hours NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'adjustment')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for time_entries
CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_id ON time_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_user_date ON time_entries(tenant_id, user_id, date);

-- Trigger for updated_at
CREATE TRIGGER time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for time_entries
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for time_entries
CREATE POLICY "Users can view own time entries within tenant" ON time_entries
  FOR SELECT USING (
    auth.uid() = user_id 
    AND tenant_id = public.get_user_tenant(auth.uid())
  );

CREATE POLICY "Tenant admins can view all time entries" ON time_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('tenant_admin', 'master_admin')
      AND profiles.tenant_id = time_entries.tenant_id
    )
  );

CREATE POLICY "Users can insert own time entries" ON time_entries
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND tenant_id = public.get_user_tenant(auth.uid())
  );

CREATE POLICY "Tenant admins can insert time entries" ON time_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('tenant_admin', 'master_admin')
      AND profiles.tenant_id = time_entries.tenant_id
    )
  );

CREATE POLICY "Tenant admins can update time entries" ON time_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('tenant_admin', 'master_admin')
      AND profiles.tenant_id = time_entries.tenant_id
    )
  );

-- =====================================================
-- TABLE 7: system_logs (application activity logging)
-- =====================================================
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert logs
CREATE POLICY "allow_authenticated_insert_system_logs" ON system_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to view logs within tenant
CREATE POLICY "allow_authenticated_select_system_logs" ON system_logs FOR SELECT USING (
  auth.role() = 'authenticated' 
  AND (tenant_id = public.get_user_tenant(auth.uid()) OR tenant_id IS NULL)
);

-- Allow service role full access
CREATE POLICY "service_role_all_system_logs" ON system_logs FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_tenant_id ON system_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_logs_module ON system_logs(module);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
