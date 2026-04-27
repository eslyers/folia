"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminDashboard } from "./AdminDashboard";
import { Building2, ChevronDown, X } from "lucide-react";
import { clsx } from "clsx";
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
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const supabase = createClient();

  const currentTenantName = selectedTenantId 
    ? tenants.find(t => t.id === selectedTenantId)?.name || ""
    : "";

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.tenant-dropdown')) {
        setTenantDropdownOpen(false);
      }
    };
    if (tenantDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [tenantDropdownOpen]);

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
            <div className="relative">
              <button
                onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white hover:border-[#5C724A] transition-colors min-w-[200px]"
              >
                <Building2 className="h-4 w-4 text-[#5C724A]" />
                <span className="flex-1 text-sm text-[var(--color-brown-dark)] text-left">
                  {currentTenantName || "Todas as empresas"}
                </span>
                {selectedTenantId && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setSelectedTenantId(""); }}
                    className="p-0.5 rounded hover:bg-gray-100 text-gray-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${tenantDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {tenantDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Empresas</p>
                  </div>
                  <button
                    onClick={() => { setSelectedTenantId(""); setTenantDropdownOpen(false); }}
                    className={clsx(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors",
                      !selectedTenantId && "bg-[#5C724A]/5 text-[#5C724A]"
                    )}
                  >
                    <Building2 className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1">Todas as empresas</span>
                    {!selectedTenantId && <span className="text-xs text-[#5C724A] font-medium">Atual</span>}
                  </button>
                  {tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => { setSelectedTenantId(tenant.id); setTenantDropdownOpen(false); }}
                      className={clsx(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors",
                        tenant.id === selectedTenantId && "bg-[#5C724A]/5 text-[#5C724A]"
                      )}
                    >
                      <Building2 className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 truncate">{tenant.name}</span>
                      {tenant.id === selectedTenantId && <span className="text-xs text-[#5C724A] font-medium">Atual</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
