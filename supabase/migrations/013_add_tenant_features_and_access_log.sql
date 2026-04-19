-- Migration 013: Tenant Features & User Access Log
-- Execute no Supabase SQL Editor

-- 1. tenant_features table
CREATE TABLE IF NOT EXISTS tenant_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  max_value INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, feature)
);

-- 2. user_access_log table
CREATE TABLE IF NOT EXISTS user_access_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. indexes
CREATE INDEX IF NOT EXISTS idx_tenant_features_tenant_id ON tenant_features(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_access_log_user_id ON user_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_log_created_at ON user_access_log(created_at);

-- 4. RLS
ALTER TABLE tenant_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_access_log ENABLE ROW LEVEL SECURITY;

-- master_admin can do anything with these tables
CREATE POLICY "master_admin_all_tenant_features" ON tenant_features
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "master_admin_all_user_access_log" ON user_access_log
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Seed default features for existing tenants
INSERT INTO tenant_features (tenant_id, feature, enabled, max_value)
SELECT id, f.feature, true, f.default_max
FROM tenants
CROSS JOIN (VALUES
  ('vacation_management', 30),
  ('time_tracking', 100),
  ('hours_bank', 200),
  ('reports_csv', 1),
  ('webhooks', 5),
  ('national_holidays', 1),
  ('bulk_actions', 1),
  ('configurable_policies', 1),
  ('push_notifications', 1),
  ('mobile_app', 1)
) AS f(feature, default_max)
ON CONFLICT (tenant_id, feature) DO NOTHING;
