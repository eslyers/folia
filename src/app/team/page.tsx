"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar as CalendarIcon, Users } from "lucide-react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { LEAVE_TYPE_LABELS } from "@/lib/types";
import type { Profile, LeaveRequest } from "@/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/calendar/Calendar";

export default function TeamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allApproved, setAllApproved] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      try {

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setLoading(false);
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
          setLoading(false);
          return;
        }

        setProfile(profileData);

        // Fetch ALL approved leave requests (everyone sees all)
        const { data: approved, error: approvedError } = await supabase
          .from("leave_requests")
          .select("*")
          .eq("status", "approved")
          .order("start_date", { ascending: true });

        if (approvedError) {
          setLoading(false);
          return;
        }

        // Fetch all profiles for names
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("*")
          .order("name");

        setProfiles(allProfiles || []);
        setAllApproved(approved || []);
        setLoading(false);
      } catch (err: any) {
        setLoading(false);
      }
    }

    fetchData();
  }, [router, supabase]);

  const getUserName = (userId: string) => {
    const user = profiles.find((p) => p.id === userId);
    return user?.name || "Usuário";
  };

  const getUserEmail = (userId: string) => {
    const user = profiles.find((p) => p.id === userId);
    return user?.email || "";
  };

  // Group by month for easier reading
  const groupByMonth = () => {
    const groups: Record<string, { label: string; requests: any[] }> = {};
    allApproved.forEach((req) => {
      const monthKey = format(new Date(req.start_date), "yyyy-MM");
      const monthLabel = format(new Date(req.start_date), "MMMM yyyy", { locale: ptBR });
      if (!groups[monthKey]) {
        groups[monthKey] = { label: monthLabel, requests: [] };
      }
      groups[monthKey].requests.push(req);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  };

  const monthlyGroups = groupByMonth();

  // Current and upcoming leaves
  const now = new Date();
  const currentLeaves = allApproved.filter((r) => {
    const start = new Date(r.start_date);
    const end = new Date(r.end_date);
    return start <= now && end >= now;
  });

  const upcomingLeaves = allApproved.filter((r) => {
    const start = new Date(r.start_date);
    return start > now;
  });

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

  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--cream)" }}>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
        <Header profile={profile} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8 animate-fade-in-up">
            <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
              Calendário da Equipe 👥
            </h1>
            <p className="text-[var(--color-brown-medium)] mt-1">
              Veja quando seus colegas estarão de folga
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-green-50">
                  <Users className="h-6 w-6 text-[var(--color-success)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--color-brown-medium)]">Total de Folgas</p>
                  <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{allApproved.length}</p>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-50">
                  <CalendarIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-[var(--color-brown-medium)]">Agora</p>
                  <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{currentLeaves.length}</p>
                  <p className="text-xs text-[var(--color-brown-medium)]">em férias agora</p>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-50">
                  <CalendarIcon className="h-6 w-6 text-[var(--color-warning)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--color-brown-medium)]">Próximas</p>
                  <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{upcomingLeaves.length}</p>
                  <p className="text-xs text-[var(--color-brown-medium)]">agendadas</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Current absences */}
          {currentLeaves.length > 0 && (
            <Card className="p-6 mb-8 animate-fade-in-up">
              <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                Ausentes Agora
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentLeaves.map((req) => (
                  <div key={req.id} className="p-4 rounded-xl bg-green-50 border border-green-200">
                    <p className="font-semibold text-[var(--color-brown-dark)]">{getUserName(req.user_id)}</p>
                    <p className="text-sm text-green-700">{LEAVE_TYPE_LABELS[req.type as keyof typeof LEAVE_TYPE_LABELS]}</p>
                    <p className="text-xs text-green-600 mt-1">
                      {format(new Date(req.start_date), "dd/MM")} → {format(new Date(req.end_date), "dd/MM")}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Calendar */}
            <Card className="p-6 animate-fade-in-up">
              <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] mb-4 flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-[var(--color-gold)]" />
                Calendário de Férias
              </h2>
              <Calendar leaveRequests={allApproved} profiles={profiles} showNavigation />
            </Card>

            {/* Upcoming leaves */}
            <Card className="p-6 animate-fade-in-up">
              <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] mb-4">
                Próximas Folgas
              </h2>
              {upcomingLeaves.length === 0 ? (
                <div className="text-center py-8 text-[var(--color-brown-medium)]">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma folga agendada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingLeaves.slice(0, 10).map((req) => {
                    const start = new Date(req.start_date);
                    const end = new Date(req.end_date);
                    const isThisMonth = start.getMonth() === now.getMonth();
                    return (
                      <div
                        key={req.id}
                        className={`p-4 rounded-xl border ${isThisMonth ? "bg-amber-50 border-amber-200" : "bg-[var(--color-cream)] border-[var(--border)]"}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-[var(--color-brown-dark)]">
                              {getUserName(req.user_id)}
                            </p>
                            <p className="text-sm text-[var(--color-brown-medium)]">
                              {LEAVE_TYPE_LABELS[req.type as keyof typeof LEAVE_TYPE_LABELS]}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-[var(--color-brown-dark)]">
                              {format(start, "dd/MM")} - {format(end, "dd/MM")}
                            </p>
                            <p className="text-xs text-[var(--color-brown-medium)]">
                              {req.days_count} dias
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* All leaves by month */}
          <Card className="p-6 mt-8 animate-fade-in-up">
            <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] mb-4">
              Todas as Folgas por Mês
            </h2>
            {monthlyGroups.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-brown-medium)]">
                <p>Nenhuma folga registrada ainda</p>
              </div>
            ) : (
              <div className="space-y-6">
                {monthlyGroups.map(([monthKey, group]: [string, any]) => (
                  <div key={monthKey}>
                    <h3 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-3 capitalize">
                      {group.label}
                    </h3>
                    <div className="space-y-2">
                      {group.requests.map((req: any) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-cream)]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center">
                              <span className="text-sm font-semibold text-[var(--color-gold)]">
                                {getUserName(req.user_id).charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-[var(--color-brown-dark)]">
                                {getUserName(req.user_id)}
                              </p>
                              <p className="text-xs text-[var(--color-brown-medium)]">
                                {getUserEmail(req.user_id)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex items-center rounded-full border border-transparent bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5">{LEAVE_TYPE_LABELS[req.type as keyof typeof LEAVE_TYPE_LABELS]}</span>
                            <p className="text-xs text-[var(--color-brown-medium)] mt-1">
                              {format(new Date(req.start_date), "dd/MM")} - {format(new Date(req.end_date), "dd/MM")} • {req.days_count} dias
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </main>
      </div>
  );
}
