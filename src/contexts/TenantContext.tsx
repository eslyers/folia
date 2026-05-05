"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface Tenant {
  id: string;
  name: string;
  domain?: string;
}

interface TenantContextValue {
  currentTenant: Tenant | null;
  setCurrentTenant: (tenant: Tenant | null) => void;
  tenants: Tenant[];
  setTenants: (tenants: Tenant[]) => void;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  children,
  initialTenants = [],
  initialCurrentTenant = null,
}: {
  children: ReactNode;
  initialTenants?: Tenant[];
  initialCurrentTenant?: Tenant | null;
}) {
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(initialCurrentTenant);
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [isLoading, setIsLoading] = useState(true);

  // Sync currentTenant when initialCurrentTenant changes from parent (AdminLayout)
  useEffect(() => {
    if (initialCurrentTenant) {
      setCurrentTenant(initialCurrentTenant);
    }
    setIsLoading(false);
  }, [initialCurrentTenant]);

  return (
    <TenantContext.Provider value={{ currentTenant, setCurrentTenant, tenants, setTenants, isLoading }}>
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
