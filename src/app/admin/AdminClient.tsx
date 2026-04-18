"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminDashboard } from "./AdminDashboard";

export default function AdminClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
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
        
        if (!profileData || (profileData as any).role !== "admin") {
          setTimeout(() => router.push("/dashboard"), 1500);
          return;
        }

        setProfile(profileData);

        // Fetch ALL leave requests (admin should see all)
        const { data: requests, error: requestsError } = await supabase
          .from("leave_requests")
          .select("*")
          .order("created_at", { ascending: false });

        if (requestsError) {
          return;
        }

        setLeaveRequests(requests || []);

        // Fetch all profiles for the dropdown
        const { data: allProfiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .order("name");

        if (profilesError) {
        }

        setProfiles(allProfiles || []);
        setLoading(false);
      } catch (err: any) {
      }
    }

    fetchAdminData();
  }, [router, supabase]);

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

  return (
    <AdminDashboard profile={profile} leaveRequests={leaveRequests} profiles={profiles} />
  );
}