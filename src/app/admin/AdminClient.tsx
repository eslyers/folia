"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminDashboard } from "./AdminDashboard";
import { isTenantAdmin, isMasterAdmin, getHomeRoute } from "@/lib/auth";
import { useTenant } from "@/contexts/TenantContext";
import type { Profile, LeaveRequest } from "@/lib/types";

export default function AdminClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const { currentTenant } = useTenant();
  const supabase = createClient();

  useEffect(() => {
    async function fetchAdminData() {
      try {
        
        // Use getSession instead of getUser to detect existing session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          return;
        }
        
        if (!session?.user) {
          setTimeout(() => router.push("/login"), 1500);
          return;
        }


        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (profileError) {
          return;
        }
        
        if (!profileData || !isTenantAdmin(profileData.role)) {
          setTimeout(() => router.push(getHomeRoute(profileData?.role)), 1500);
          return;
        }

        setProfile(profileData);

        // Build query for leave requests - filter by tenant if selected
        let requestsQuery = supabase
          .from("leave_requests")
          .select("*")
          .order("created_at", { ascending: false });
        
        // Master admin with tenant selected: filter by tenant
        if (isMasterAdmin(profileData.role) && currentTenant?.id) {
          requestsQuery = requestsQuery.eq("tenant_id", currentTenant.id);
        } else if (profileData.tenant_id) {
          // Non-master admin: filter by their tenant
          requestsQuery = requestsQuery.eq("tenant_id", profileData.tenant_id);
        }
        
        const { data: requests, error: requestsError } = await requestsQuery;

        if (requestsError) {
          return;
        }

        setLeaveRequests(requests || []);

        // Fetch profiles - filter by tenant if selected
        let profilesQuery = supabase
          .from("profiles")
          .select("*")
          .order("name");
        
        if (isMasterAdmin(profileData.role) && currentTenant?.id) {
          profilesQuery = profilesQuery.eq("tenant_id", currentTenant.id);
        } else if (profileData.tenant_id) {
          profilesQuery = profilesQuery.eq("tenant_id", profileData.tenant_id);
        }

        const { data: allProfiles, error: profilesError } = await profilesQuery;

        if (profilesError) {
        }

        setProfiles(allProfiles || []);
        setLoading(false);
      } catch {
      }
    }

    fetchAdminData();
  }, [router, supabase, currentTenant]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "var(--cream)" }}>
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
          <p style={{ color: "var(--brown-medium)" }}>Carregando admin...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <AdminDashboard profile={profile} leaveRequests={leaveRequests} profiles={profiles} />
  );
}
