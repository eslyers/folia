"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import type { Profile } from "@/lib/types";
import { isTenantAdmin, isMasterAdmin } from "@/lib/auth";

interface Tenant {
  id: string;
  name: string;
  domain?: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single() as { data: Profile | null };

      if (!profileData || !isTenantAdmin(profileData.role)) {
        router.push("/dashboard");
        return;
      }

      setProfile(profileData);

      // Fetch tenants
      if (isMasterAdmin(profileData.role)) {
        // Master admin sees all tenants
        const { data: allTenants } = await supabase
          .from("tenants")
          .select("id, name, domain")
          .order("name");
        setTenants(allTenants || []);
      } else if (profileData.tenant_id) {
        // Regular admin sees only their tenant
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("id, name, domain")
          .eq("id", profileData.tenant_id)
          .single();
        if (tenantData) {
          setTenants([tenantData]);
          setCurrentTenant(tenantData);
        }
      }

      setLoading(false);
    };

    checkUser();
  }, [pathname]);

  const handleTenantChange = (tenant: Tenant) => {
    setCurrentTenant(tenant);
    // Could also update profile.tenant_id and refresh data
  };

  if (loading || !profile) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        backgroundColor: "var(--cream)" 
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ 
            width: "48px", 
            height: "48px", 
            border: "4px solid var(--color-gold)", 
            borderTop: "4px solid transparent", 
            borderRadius: "50%", 
            animation: "spin 1s linear infinite",
            margin: "0 auto 16px"
          }} />
          <p style={{ color: "var(--brown-medium)" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Topbar 
        profile={profile} 
        tenants={tenants}
        currentTenant={currentTenant}
        onTenantChange={handleTenantChange}
        onMenuToggle={() => setSidebarOpen(prev => !prev)} 
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          profile={profile} 
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}