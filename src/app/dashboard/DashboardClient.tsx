"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, LeaveRequest } from "@/lib/types";
import { EmployeeDashboard } from "./EmployeeDashboard";
import { Button } from "@/components/ui";

export default function DashboardClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [hourEntries, setHourEntries] = useState<any[]>([]);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const fetchData = useCallback(async () => {
    try {
      // Use getUser() for secure server-validated auth check
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/login");
        return;
      }
      
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        setLoading(false);
        return;
      }
      
      if (!profileData) {
        setLoading(false);
        return;
      }


      if ((profileData as any).role === "admin") {
        router.push("/admin");
        return;
      }

      const { data: requests, error: requestsError } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (requestsError) {
        setLoading(false);
        return;
      }

      // Fetch hour entries
      const { data: hourEntriesData } = await supabase
        .from("hour_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setProfile(profileData);
      setLeaveRequests(requests || []);
      setHourEntries(hourEntriesData || []);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          <p style={{ color: "var(--brown-medium)" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <EmployeeDashboard
      profile={profile}
      leaveRequests={leaveRequests}
      hourEntries={hourEntries}
      onRefresh={fetchData}
    />
  );
}