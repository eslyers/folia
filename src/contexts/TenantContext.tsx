"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { isMasterAdmin } from "@/lib/auth";

interface Tenant {
  id: string;
  name: string;
  domain?: string;
}

interface TenantContextValue {
  currentTenant: Tenant | null;
  setCurrentTenant: (tenant: Tenant | null) => void;
  tenants: Tenant[];
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchTenants = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role, tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) {
        setIsLoading(false);
        return;
      }

      if (isMasterAdmin(profile.role)) {
        // Master admin sees all tenants
        const { data: allTenants } = await supabase
          .from("tenants")
          .select("id, name, domain")
          .order("name");
        setTenants(allTenants || []);
      } else if (profile.tenant_id) {
        // Regular admin sees only their tenant
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("id, name, domain")
          .eq("id", profile.tenant_id)
          .single();
        if (tenantData) {
          setTenants([tenantData]);
          setCurrentTenant(tenantData);
        }
      }

      setIsLoading(false);
    };

    fetchTenants();
  }, []);

  return (
    <TenantContext.Provider value={{ currentTenant, setCurrentTenant, tenants, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within TenantProvider");
  }
  return context;
}
