"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import type { Profile } from "@/lib/types";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <SettingsLayoutContent>{children}</SettingsLayoutContent>
    </TenantProvider>
  );
}

function SettingsLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentTenant, tenants } = useTenant();
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
        .single();

      if (!profileData) {
        router.push("/login");
        return;
      }

      setProfile(profileData);
      setLoading(false);
    };

    checkUser();
  }, [router, supabase]);

  if (loading || !profile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--cream)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "48px",
            height: "48px",
            border: "4px solid var(--color-gold)",
            borderTop: "4px solid transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 16px",
          }} />
          <p style={{ color: "var(--brown-medium)" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar
          profile={profile}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar
            profile={profile}
            currentTenant={currentTenant ?? undefined}
            tenants={tenants}
            onMenuToggle={() => setSidebarOpen(prev => !prev)}
          />
          <main className="flex-1 overflow-auto bg-gray-100">
            {children}
          </main>
        </div>
      </div>
  );
}
