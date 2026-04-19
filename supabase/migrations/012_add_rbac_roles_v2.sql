-- Migration 012: Multi-Tenant RBAC (simplified)
-- Executar no Supabase SQL Editor

-- 1. Criar enum role (se não existir)
DO $$ BEGIN
    CREATE TYPE role AS ENUM ('master_admin', 'tenant_admin', 'gestor', 'funcionario', 'admin', 'employee');
EXCEPTION
    WHEN duplicate_object THEN 
    ALTER TYPE role ADD VALUE 'master_admin';
    ALTER TYPE role ADD VALUE 'tenant_admin';
    ALTER TYPE role ADD VALUE 'gestor';
    ALTER TYPE role ADD VALUE 'funcionario';
END $$;

-- 2. Adicionar colunas na profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. Migrar roles antigos
UPDATE profiles SET role = 'tenant_admin' WHERE role = 'admin';
UPDATE profiles SET role = 'funcionario' WHERE role = 'employee';

-- 4. Criar índices
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);