-- Migration 014: System Logs Table
-- Execute no Supabase SQL Editor

-- 1. system_logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. indexes
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_tenant_id ON system_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_logs_module ON system_logs(module);

-- 3. RLS
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Policies: master_admin can see all, tenant_admin can see their tenant's logs
CREATE POLICY "master_admin_read_all_system_logs" ON system_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = current_setting('request.jwt.claims', true)::json->>'user_id' 
      AND profiles.role = 'master_admin'
    )
    OR
    (current_setting('request.jwt.claims', true)::json->>'user_id' IS NOT NULL 
     AND tenant_id IN (
       SELECT tenant_id FROM profiles 
       WHERE profiles.id = current_setting('request.jwt.claims', true)::json->>'user_id'
     ))
  );

-- Allow insert for authenticated users (system logging)
CREATE POLICY "authenticated_users_insert_system_logs" ON system_logs
  FOR INSERT WITH CHECK (true);

-- Or simpler policy for now
DROP POLICY IF EXISTS "master_admin_read_all_system_logs" ON system_logs;
DROP POLICY IF EXISTS "authenticated_users_insert_system_logs" ON system_logs;

-- Simpler policies for development
CREATE POLICY "allow_all_read_system_logs" ON system_logs
  FOR SELECT USING (true);

CREATE POLICY "allow_all_insert_system_logs" ON system_logs
  FOR INSERT WITH CHECK (true);

-- Function to automatically log actions
CREATE OR REPLACE FUNCTION log_action(
  p_user_id UUID,
  p_tenant_id UUID,
  p_action TEXT,
  p_module TEXT,
  p_details TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO system_logs (user_id, tenant_id, action, module, details, ip_address)
  VALUES (p_user_id, p_tenant_id, p_action, p_module, p_details, p_ip_address)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
