"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui";
import { Calendar } from "@/components/calendar/Calendar";
import { useTenant } from "@/contexts/TenantContext";
import type { LeaveRequest, Profile } from "@/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Users } from "lucide-react";

export default function DashboardTeamPage() {
  const router = useRouter();
  const supabase = createClient();
  const { currentTenant } = useTenant();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push("/login");
          return;
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (!profileData) {
          router.push("/login");
          return;
        }

        setProfile(profileData as any);

        const tenantId = currentTenant?.id || (profileData as any).tenant_id;

        // Requests aprovados + pendentes = "previstos"
        let reqQuery = supabase
          .from("leave_requests")
          .select("*")
          .in("status", ["approved", "pending"])
          .order("start_date", { ascending: true });

        let profQuery = supabase
          .from("profiles")
          .select("*")
          .order("name");

        if (tenantId) {
          reqQuery = reqQuery.eq("tenant_id", tenantId);
          profQuery = profQuery.eq("tenant_id", tenantId);
        }

        const { data: reqs } = await reqQuery;
        const { data: profs } = await profQuery;

        setRequests((reqs || []) as any);
        setProfiles((profs || []) as any);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    }

    fetchData();
  }, [router, supabase, currentTenant?.id]);

  const now = useMemo(() => new Date(), []);

  const currentLeaves = useMemo(() => {
    return requests.filter((r) => {
      const start = new Date(r.start_date);
      const end = new Date(r.end_date);
      return start <= now && end >= now;
    });
  }, [requests, now]);

  const upcomingLeaves = useMemo(() => {
    return requests.filter((r) => new Date(r.start_date) > now);
  }, [requests, now]);

  const getUserName = (userId: string) => {
    const u = profiles.find((p) => p.id === userId);
    return u?.name || "Usuário";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--cream)]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--brown-medium)]">Carregando equipe...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl font-bold text-gray-900">Calendário da Equipe 👥</h1>
        <p className="text-gray-500 mt-1">Veja quem está de férias agora e quem está previsto</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-50">
              <Users className="h-6 w-6 text-[var(--color-success)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-brown-medium)]">Total de Folgas</p>
              <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{requests.length}</p>
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
              <p className="text-xs text-[var(--color-brown-medium)]">previstas</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-4">Calendário</h2>
          <Calendar leaveRequests={requests as any} profiles={profiles as any} size="normal" showNavigation />
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-4">Próximas Folgas</h2>
          <div className="space-y-3">
            {upcomingLeaves.slice(0, 8).map((r) => (
              <div key={r.id} className="p-3 rounded-xl bg-[var(--color-cream)] border border-[var(--border)]">
                <p className="font-semibold text-[var(--color-brown-dark)] truncate">{getUserName(r.user_id)}</p>
                <p className="text-xs text-[var(--color-brown-medium)] mt-1">
                  {format(new Date(r.start_date), "dd/MM", { locale: ptBR })} → {format(new Date(r.end_date), "dd/MM", { locale: ptBR })}
                </p>
                <p className="text-xs text-[var(--color-brown-medium)]">
                  {(r as any).status === "pending" ? "Previsto (pendente)" : "Aprovado"}
                </p>
              </div>
            ))}
            {upcomingLeaves.length === 0 && (
              <p className="text-sm text-[var(--color-brown-medium)]">Nenhuma folga prevista.</p>
            )}
          </div>
        </Card>
      </div>
      </div>
    </div>
  );
}

