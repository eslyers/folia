"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminDashboard } from "./AdminDashboard";
import { isTenantAdmin } from "@/lib/auth";

export default function AdminPage() {
  return <AdminContent />;
}

function AdminContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const supabase = createClient();

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

      // Fetch leave requests WITHOUT JOINS (avoids RLS issues with profile data)
      const { data: requests } = await supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });

      // Fetch all profiles separately (admin can see all via is_admin policy)
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("*")
        .order("name");

      console.log("[ADMIN] Requests fetched:", requests?.length, requests);
      console.log("[ADMIN] Profiles fetched:", allProfiles?.length, allProfiles);

      setLeaveRequests(requests || []);
      setProfiles(allProfiles || []);
      setLoading(false);
    };

    checkUser();
  }, []);

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

  return <AdminDashboard profile={profile} leaveRequests={leaveRequests} profiles={profiles} />;
}