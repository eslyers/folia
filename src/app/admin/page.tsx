"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminDashboard } from "./AdminDashboard";
import { isTenantAdmin, isMasterAdmin } from "@/lib/auth";

export default function AdminPage() {
  return <AdminContent />;
}

function AdminContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const supabase = createClient();

  // Fetch data based on selected tenant
  const fetchData = async (tenantId: string | null) => {
    // Fetch leave requests WITHOUT tenant filter (leave_requests table doesn't have tenant_id column)
    const { data: requests } = await supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });


    // Fetch profiles filtered by tenant (profiles table has tenant_id)
    let profilesQuery = supabase
      .from("profiles")
      .select("*")
      .order("name");
    
    if (tenantId) {
      profilesQuery = profilesQuery.eq("tenant_id", tenantId);
    }
    const { data: allProfiles } = await profilesQuery;

    console.log("[ADMIN] Requests fetched:", requests?.length);
    console.log("[ADMIN] Profiles fetched:", allProfiles?.length);

    setLeaveRequests(requests || []);
    setProfiles(allProfiles || []);
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login");
        return;
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profileData || !isTenantAdmin((profileData as any).role)) {
        router.push("/dashboard");
        return;
      }

      setProfile(profileData);

      const adminRole = (profileData as any)?.role;
      const adminTenantId = (profileData as any)?.tenant_id;
      console.log("[ADMIN] Admin tenant_id:", adminTenantId);
      console.log("[ADMIN] Admin role:", adminRole);

      // Set default tenant for non-master admins
      if (!isMasterAdmin(adminRole) && adminTenantId) {
        setSelectedTenantId(adminTenantId);
        await fetchData(adminTenantId);
      } else if (isMasterAdmin(adminRole)) {
        // Fetch all tenants for master_admin
        const { data: allTenants } = await supabase
          .from("tenants")
          .select("id, name")
          .order("name");
        setTenants(allTenants || []);
        // Fetch all data (no filter)
        await fetchData(null);
      }

      setLoading(false);
    };

    checkUser();
  }, []);

  // Re-fetch when tenant selection changes
  useEffect(() => {
    if (profile && selectedTenantId) {
      // For master_admin, fetchData is called on tenant change
      // For tenant_admin, we already fetched with their tenant on mount
      if (isMasterAdmin(profile.role)) {
        fetchData(selectedTenantId || null);
      }
    }
  }, [selectedTenantId]);

  if (loading) {
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
            margin: "0 auto 16px"
          }} />
          <p style={{ color: "var(--brown-medium)" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      {/* Tenant Selector for Master Admin */}
      {isMasterAdmin(profile?.role) && tenants.length > 0 && (
        <div className="bg-white border-b border-[var(--border)] px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <label className="text-sm font-medium text-[var(--color-brown-dark)]">
              Filtrar por empresa:
            </label>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="px-4 py-2 rounded-lg border border-[var(--border)] bg-white text-[var(--color-brown-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
            >
              <option value="">Todas as empresas</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      
      <AdminDashboard 
        profile={profile} 
        leaveRequests={leaveRequests} 
        profiles={profiles}
        selectedTenantId={selectedTenantId}
      />
    </div>
  );
}
