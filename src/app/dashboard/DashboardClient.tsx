"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EmployeeDashboard } from "./EmployeeDashboard";
import { Button } from "@/components/ui";

export default function DashboardClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [hourEntries, setHourEntries] = useState<any[]>([]);
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    try {
      
      // getSession checks localStorage first (synchronous-ish)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      
      if (sessionError) {
        setLoading(false);
        return;
      }
      
      if (!session?.user) {
        setTimeout(() => router.push("/login"), 1500);
        return;
      }

      const user = session.user;
      
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
  }, [supabase, router]);

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

  return (
    <EmployeeDashboard
      profile={profile}
      leaveRequests={leaveRequests}
      hourEntries={hourEntries}
      onRefresh={fetchData}
    />
  );
}