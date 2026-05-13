-- FOLIA - Schema Consolidado v2.0 (pós-migrations 001-017)
-- Multi-Tenant SaaS com RBAC 4 níveis
-- Roles: master_admin > tenant_admin > gestor > funcionario

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- HELPER: update_updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TABLE: tenants
-- =====================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON tenants(is_active);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_can_view_active_tenants" ON tenants FOR SELECT USING (is_active = true);
CREATE POLICY "service_role_manage_tenants" ON tenants FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO tenants (id, name, slug, settings, is_active)
VALUES ('00000000-0000-0000-0000-000000000000','Empresa Padrão','default','{"timezone":"America/Sao_Paulo","locale":"pt-BR"}',true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TABLE: profiles
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'funcionario'
    CHECK (role IN ('master_admin','tenant_admin','gestor','funcionario','admin','employee')),
  avatar_url TEXT,
  vacation_balance INTEGER NOT NULL DEFAULT 30,
  hours_balance INTEGER NOT NULL DEFAULT 0,
  department TEXT,
  position TEXT,
  phone TEXT,
  emergency_contact TEXT,
  hire_date DATE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES tenants(id),
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  schedule_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

-- =====================================================
-- TABLE: work_schedules
-- =====================================================
CREATE TABLE IF NOT EXISTS work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES tenants(id),
  name TEXT NOT NULL,
  daily_hours NUMERIC(4,2) NOT NULL DEFAULT 8,
  monday BOOLEAN NOT NULL DEFAULT true,
  tuesday BOOLEAN NOT NULL DEFAULT true,
  wednesday BOOLEAN NOT NULL DEFAULT true,
  thursday BOOLEAN NOT NULL DEFAULT true,
  friday BOOLEAN NOT NULL DEFAULT true,
  saturday BOOLEAN NOT NULL DEFAULT false,
  sunday BOOLEAN NOT NULL DEFAULT false,
  tolerance_minutes INTEGER NOT NULL DEFAULT 5,
  start_work TIME DEFAULT '09:00',
  end_work TIME DEFAULT '18:00',
  lunch_duration_minutes INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER work_schedules_updated_at BEFORE UPDATE ON work_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS idx_work_schedules_tenant_id ON work_schedules(tenant_id);
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_work_schedules" ON work_schedules FOR ALL TO service_role USING (true) WITH CHECK (true);
-- F-01 FIX: RLS for authenticated users
CREATE POLICY "rbac_master_admin_schedules" ON work_schedules
  FOR ALL USING (is_master_admin(auth.uid()) = true);
CREATE POLICY "rbac_tenant_view_schedules" ON work_schedules
  FOR SELECT TO authenticated USING (
    tenant_id = get_user_tenant(auth.uid())
  );
CREATE POLICY "rbac_tenant_admin_manage_schedules" ON work_schedules
  FOR ALL USING (
    is_tenant_admin(auth.uid(), tenant_id) = true
  );

ALTER TABLE profiles ADD CONSTRAINT fk_profiles_schedule FOREIGN KEY (schedule_id) REFERENCES work_schedules(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- =====================================================
-- TABLE: leave_requests
-- =====================================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES tenants(id),
  type TEXT NOT NULL CHECK (type IN ('vacation','day_off','hours','sick','other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  hours_count INTEGER DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_days CHECK (days_count > 0)
);

CREATE TRIGGER leave_requests_updated_at BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant_id ON leave_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

-- =====================================================
-- TABLE: policies
-- =====================================================
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES tenants(id),
  name TEXT NOT NULL,
  vacation_days_per_year INTEGER NOT NULL DEFAULT 30,
  carry_over_days INTEGER NOT NULL DEFAULT 5,
  max_consecutive_days INTEGER NOT NULL DEFAULT 30,
  min_days_notice INTEGER NOT NULL DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER policies_updated_at BEFORE UPDATE ON policies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_policies" ON policies FOR ALL TO service_role USING (true) WITH CHECK (true);
-- F-01 FIX: RLS for authenticated users
CREATE POLICY "rbac_master_admin_policies" ON policies
  FOR ALL USING (is_master_admin(auth.uid()) = true);
CREATE POLICY "rbac_tenant_view_policies" ON policies
  FOR SELECT TO authenticated USING (
    tenant_id = get_user_tenant(auth.uid())
  );
CREATE POLICY "rbac_tenant_admin_manage_policies" ON policies
  FOR ALL USING (
    is_tenant_admin(auth.uid(), tenant_id) = true
  );

-- =====================================================
-- TABLE: notifications
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','error')),
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_notifications" ON notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- TABLE: notification_logs
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','failed','pending')),
  message TEXT NOT NULL,
  email_sent BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant_id ON notification_logs(tenant_id);
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_notification_logs" ON notification_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "auth_view_notification_logs" ON notification_logs FOR SELECT TO authenticated USING (true);

-- =====================================================
-- TABLE: hour_entries
-- =====================================================
CREATE TABLE IF NOT EXISTS hour_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('extra','compensated')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hour_entries_user_id ON hour_entries(user_id);
ALTER TABLE hour_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_hour_entries" ON hour_entries FOR ALL TO service_role USING (true) WITH CHECK (true);
-- F-01 FIX: RLS for authenticated users
CREATE POLICY "rbac_master_admin_hours" ON hour_entries
  FOR ALL USING (is_master_admin(auth.uid()) = true);
CREATE POLICY "rbac_employee_own_hours" ON hour_entries
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "rbac_gestor_view_hours" ON hour_entries
  FOR SELECT USING (is_manager_of(auth.uid(), user_id) = true);
CREATE POLICY "rbac_tenant_admin_hours" ON hour_entries
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = hour_entries.user_id
      AND is_tenant_admin(auth.uid(), p.tenant_id) = true
    )
  );

-- =====================================================
-- TABLE: time_entries
-- =====================================================
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMP WITH TIME ZONE,
  clock_out TIMESTAMP WITH TIME ZONE,
  lunch_start TIMESTAMP WITH TIME ZONE,
  lunch_end TIMESTAMP WITH TIME ZONE,
  total_hours NUMERIC(5,2),
  overtime_hours NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','adjustment')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER time_entries_updated_at BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_id ON time_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_time_entries" ON time_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- TABLE: monthly_timesheets
-- =====================================================
CREATE TABLE IF NOT EXISTS monthly_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  total_worked_hours NUMERIC(6,2) DEFAULT 0,
  total_overtime_hours NUMERIC(6,2) DEFAULT 0,
  approved_overtime_hours NUMERIC(6,2) DEFAULT 0,
  overtime_pending_approval NUMERIC(6,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','approved')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month)
);

ALTER TABLE monthly_timesheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_monthly_timesheets" ON monthly_timesheets FOR ALL TO service_role USING (true) WITH CHECK (true);
-- F-01 FIX: RLS for authenticated users
CREATE POLICY "rbac_master_admin_timesheets" ON monthly_timesheets
  FOR ALL USING (is_master_admin(auth.uid()) = true);
CREATE POLICY "rbac_tenant_admin_timesheets" ON monthly_timesheets
  FOR ALL USING (
    is_tenant_admin(auth.uid(), tenant_id) = true
  );
CREATE POLICY "rbac_employee_own_timesheets" ON monthly_timesheets
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "rbac_gestor_view_timesheets" ON monthly_timesheets
  FOR SELECT USING (is_manager_of(auth.uid(), user_id) = true);

-- =====================================================
-- TABLE: audit_log
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_audit" ON audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- TABLE: system_logs
-- =====================================================
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_tenant_id ON system_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_system_logs" ON system_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- RBAC HELPER FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION is_master_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = user_id AND role = 'master_admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_tenant_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id AND role IN ('master_admin','tenant_admin'));
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_tenant_admin(user_id UUID, tenant_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = user_id AND role IN ('master_admin','tenant_admin') AND tenant_id = tenant_uuid);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_manager_of(p_manager_id UUID, p_employee_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = p_employee_id AND manager_id = p_manager_id);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_tenant(p_user_id UUID)
RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_access_tenant_data(p_user_id UUID, p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF is_master_admin(p_user_id) THEN RETURN true; END IF;
  RETURN get_user_tenant(p_user_id) = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_tenant_active(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT is_active FROM tenants WHERE id = p_tenant_id), false);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- PROFILES RLS (RBAC)
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rbac_master_admin_profiles" ON profiles
  FOR ALL USING (is_master_admin(auth.uid()) = true);

CREATE POLICY "rbac_tenant_admin_profiles" ON profiles
  FOR ALL USING (is_tenant_admin(auth.uid(), tenant_id) = true OR id = auth.uid());

CREATE POLICY "rbac_gestor_view_profiles" ON profiles
  FOR SELECT USING (is_manager_of(auth.uid(), id) = true OR id = auth.uid());

CREATE POLICY "rbac_employee_profiles" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "service_role_profiles" ON profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- LEAVE_REQUESTS RLS
-- =====================================================
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rbac_master_admin_requests" ON leave_requests
  FOR ALL USING (is_master_admin(auth.uid()) = true);

CREATE POLICY "rbac_tenant_admin_requests" ON leave_requests
  FOR ALL USING (is_tenant_admin(auth.uid(), tenant_id) = true OR user_id = auth.uid());

CREATE POLICY "rbac_gestor_requests" ON leave_requests
  FOR ALL USING (is_manager_of(auth.uid(), user_id) = true OR user_id = auth.uid());

CREATE POLICY "rbac_employee_requests" ON leave_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "rbac_employee_insert_requests" ON leave_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_role_requests" ON leave_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- TIME_ENTRIES RLS
-- =====================================================
CREATE POLICY "rbac_master_admin_time" ON time_entries
  FOR ALL USING (is_master_admin(auth.uid()) = true);

CREATE POLICY "rbac_tenant_admin_time" ON time_entries
  FOR ALL USING (is_tenant_admin(auth.uid(), tenant_id) = true OR user_id = auth.uid());

CREATE POLICY "rbac_gestor_time" ON time_entries
  FOR SELECT USING (is_manager_of(auth.uid(), user_id) = true OR user_id = auth.uid());

CREATE POLICY "rbac_employee_time" ON time_entries
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- NOTIFICATIONS RLS
-- =====================================================
CREATE POLICY "rbac_user_notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "rbac_user_update_notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- ATOMIC RPC FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION deduct_vacation_balance(p_user_id UUID, p_days INTEGER, p_expected_balance INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET vacation_balance = vacation_balance - p_days
  WHERE id = p_user_id AND vacation_balance = p_expected_balance;
  IF NOT FOUND THEN RAISE EXCEPTION 'Balance modified concurrently'; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION deduct_hours_balance(p_user_id UUID, p_minutes INTEGER, p_expected_balance INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET hours_balance = hours_balance - p_minutes
  WHERE id = p_user_id AND hours_balance = p_expected_balance;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hours balance modified concurrently'; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION add_hours_balance(p_user_id UUID, p_minutes INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET hours_balance = hours_balance + p_minutes WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, vacation_balance, hours_balance, tenant_id)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'funcionario', 30, 0,
    COALESCE((SELECT id FROM tenants WHERE slug = 'default' LIMIT 1), '00000000-0000-0000-0000-000000000000'::uuid)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- TENANT CASCADE DELETION TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION handle_tenant_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.id = '00000000-0000-0000-0000-000000000000'::UUID THEN
    RAISE EXCEPTION 'Cannot delete the default tenant';
  END IF;
  DELETE FROM leave_requests WHERE user_id IN (SELECT id FROM profiles WHERE tenant_id = OLD.id);
  DELETE FROM time_entries WHERE tenant_id = OLD.id;
  DELETE FROM notifications WHERE user_id IN (SELECT id FROM profiles WHERE tenant_id = OLD.id);
  DELETE FROM hour_entries WHERE user_id IN (SELECT id FROM profiles WHERE tenant_id = OLD.id);
  DELETE FROM audit_log WHERE tenant_id = OLD.id;
  DELETE FROM system_logs WHERE tenant_id = OLD.id;
  DELETE FROM work_schedules WHERE tenant_id = OLD.id;
  DELETE FROM policies WHERE tenant_id = OLD.id;
  UPDATE profiles SET tenant_id = '00000000-0000-0000-0000-000000000000'::UUID WHERE tenant_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_tenant_delete ON tenants;
CREATE TRIGGER before_tenant_delete
  BEFORE DELETE ON tenants
  FOR EACH ROW EXECUTE FUNCTION handle_tenant_deletion();

-- =====================================================
-- SEED DATA
-- =====================================================
INSERT INTO policies (tenant_id, name, vacation_days_per_year, carry_over_days, max_consecutive_days, min_days_notice)
VALUES ('00000000-0000-0000-0000-000000000000','Política Padrão CLT',30,5,30,7)
ON CONFLICT DO NOTHING;

INSERT INTO work_schedules (id, tenant_id, name, daily_hours, monday, tuesday, wednesday, thursday, friday, saturday, sunday, tolerance_minutes, start_work, end_work, lunch_duration_minutes, is_active)
VALUES ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','8h Padrão CLT',8,true,true,true,true,true,false,false,5,'09:00','18:00',60,true)
ON CONFLICT (id) DO NOTHING;
