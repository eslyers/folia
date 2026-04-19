-- Migration 006: Add tenants table for multi-tenant SaaS support
-- Creates the tenants table and seeds the default tenant

-- =====================================================
-- TABLE: tenants
-- =====================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger for updated_at on tenants
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- SEED DEFAULT TENANT
-- Use fixed UUID '00000000-0000-0000-0000-000000000000' for compatibility
-- =====================================================
INSERT INTO tenants (id, name, slug, settings, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Empresa Padrão',
  'default',
  '{"timezone": "America/Sao_Paulo", "locale": "pt-BR"}',
  true
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- ENABLE RLS ON TENANTS
-- =====================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Only superadmins (service role) can manage tenants directly
-- For SaaS admin dashboard, we'll use service role API routes

-- Policy: authenticated users can view active tenants (for tenant selection)
CREATE POLICY "authenticated_can_view_active_tenants" ON tenants
  FOR SELECT USING (is_active = true);

-- Policy: service role can do everything
CREATE POLICY "service_role_manage_tenants" ON tenants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON tenants(is_active);

-- =====================================================
-- RPC: get_tenant_stats - get statistics for a tenant
-- =====================================================
CREATE OR REPLACE FUNCTION get_tenant_stats(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'employee_count', (SELECT COUNT(*) FROM profiles WHERE tenant_id = p_tenant_id),
    'pending_requests', (SELECT COUNT(*) FROM leave_requests lr 
                        JOIN profiles p ON lr.user_id = p.id 
                        WHERE p.tenant_id = p_tenant_id AND lr.status = 'pending'),
    'approved_requests', (SELECT COUNT(*) FROM leave_requests lr 
                          JOIN profiles p ON lr.user_id = p.id 
                          WHERE p.tenant_id = p_tenant_id AND lr.status = 'approved'),
    'total_requests', (SELECT COUNT(*) FROM leave_requests lr 
                       JOIN profiles p ON lr.user_id = p.id 
                       WHERE p.tenant_id = p_tenant_id)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
