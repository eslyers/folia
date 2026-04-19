"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle, Loader2, AlertCircle, Eye, Calendar } from "lucide-react";

import { Card, Button } from "@/components/ui";
import { Modal } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TeamMemberSummary {
  user_id: string;
  user_name: string;
  department: string | null;
  schedule_name: string;
  daily_hours: number;
  total_worked_hours: number;
  total_overtime_hours: number;
  approved_overtime_hours: number;
  overtime_pending_approval: number;
  expected_monthly_hours: number;
  status: "open" | "approved" | "rejected";
}

interface TimeEntry {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  total_hours: number;
  overtime_hours: number;
  status: string;
}

export default function TimesheetsPageContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberSummary[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1));
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMemberSummary | null>(null);
  const [detailEntries, setDetailEntries] = useState<TimeEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const supabase = createClient();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const monthLabel = format(currentDate, "MMMM yyyy", { locale: ptBR });

  const fetchTeamData = useCallback(async () => {
    if (!profile) return;
    try {
      const params = new URLSearchParams({
        manager_id: profile.id,
        year: String(year),
        month: String(month),
      });
      const res = await fetch(`/api/point/team?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTeamMembers(data.members || []);
    } catch (err: any) {
      console.error("Error fetching team data:", err);
    }
  }, [profile, year, month]);

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setTimeout(() => router.push("/login"), 1500);
        return;
      }
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      const adminProfile = currentProfile as any;
      if (!adminProfile || adminProfile.role !== "admin") {
        setTimeout(() => router.push("/dashboard"), 1500);
        return;
      }
      setProfile(adminProfile);
      setLoading(false);
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (profile) fetchTeamData(); }, [profile, fetchTeamData]);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const openDetails = async (member: TeamMemberSummary) => {
    setSelectedMember(member);
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({ user_id: member.user_id, year: String(year), month: String(month) });
      const res = await fetch(`/api/point/timesheets?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetailEntries(data.entries || []);
    } catch (err: any) {
      console.error("Error fetching details:", err);
      setDetailEntries([]);
    }
    setDetailLoading(false);
  };

  const doAction = async (member: TeamMemberSummary, action: "approve_all" | "reject_all") => {
    const label = action === "approve_all" ? "aprovar" : "rejeitar";
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} todas as horas extras de ${member.user_name}?`)) return;
    setActionLoading(member.user_id);
    try {
      const res = await fetch("/api/point/timesheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: member.user_id, year, month, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchTeamData();
    } catch (err: any) {
      alert("Erro: " + err.message);
    }
    setActionLoading(null);
  };

  const handleApproveDay = async (entryId: string) => {
    try {
      const res = await fetch("/api/point/timesheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedMember?.user_id, year, month, action: "approve_day", entry_id: entryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (selectedMember) await openDetails(selectedMember);
      await fetchTeamData();
    } catch (err: any) {
      alert("Erro: " + err.message);
    }
  };

  const handleRejectDay = async (entryId: string) => {
    try {
      const res = await fetch("/api/point/timesheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedMember?.user_id, year, month, action: "reject_day", entry_id: entryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (selectedMember) await openDetails(selectedMember);
      await fetchTeamData();
    } catch (err: any) {
      alert("Erro: " + err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#4A7C4E]/10 px-2.5 py-0.5 text-xs font-semibold text-[#4A7C4E]">
            <CheckCircle className="h-3 w-3" />Aprovado
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#A65D4E]/10 px-2.5 py-0.5 text-xs font-semibold text-[#A65D4E]">
            <XCircle className="h-3 w-3" />Rejeitado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#C4883A]/10 px-2.5 py-0.5 text-xs font-semibold text-[#C4883A]">
            <AlertCircle className="h-3 w-3" />Aberto
          </span>
        );
    }
  };

  const formatHours = (h: number) => `${h.toFixed(1)}h`;
  const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : "—");

  // Progress toward expected monthly hours
  const getProgressPct = (worked: number, expected: number) =>
    expected > 0 ? Math.min(100, Math.round((worked / expected) * 100)) : 0;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--color-cream)" }}>
        <div style={{ textAlign: "center" }}>
          <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: "var(--color-gold)", animation: "spin 1s linear infinite" }} />
          <p style={{ color: "var(--color-brown-medium)", marginTop: "16px" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const totalPending = teamMembers.reduce((s, m) => s + m.overtime_pending_approval, 0);
  const totalApproved = teamMembers.reduce((s, m) => s + m.approved_overtime_hours, 0);
  const totalExtra = teamMembers.reduce((s, m) => s + m.total_overtime_hours, 0);

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 200ms ease-out; }
        .animate-scale-in { animation: scale-in 200ms ease-out; }
        .progress-bar { transition: width 0.4s ease; }
      `}</style>

      <div className="min-h-screen bg-[var(--color-cream)]">
        

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-brown-dark)]" style={{ fontFamily: "var(--font-playfair)" }}>
                Controle de Ponto ⏱️
              </h1>
              <p className="text-[var(--color-brown-medium)] mt-1">Aprovação de horas extras da equipe</p>
            </div>

            {/* Month Selector */}
            <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-2 shadow-sm border border-[var(--border)]">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-[var(--color-cream)] rounded-lg transition-colors">
                <ChevronLeft className="h-5 w-5 text-[var(--color-brown-medium)]" />
              </button>
              <span className="text-sm font-semibold text-[var(--color-brown-dark)] min-w-[130px] text-center capitalize">
                {monthLabel}
              </span>
              <button onClick={handleNextMonth} className="p-1 hover:bg-[var(--color-cream)] rounded-lg transition-colors">
                <ChevronRight className="h-5 w-5 text-[var(--color-brown-medium)]" />
              </button>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[#C4883A]/10">
                  <Clock className="h-6 w-6 text-[#C4883A]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--color-brown-medium)]">Total Horas Extras</p>
                  <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{formatHours(totalExtra)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[#C4883A]/10">
                  <AlertCircle className="h-6 w-6 text-[#C4883A]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--color-brown-medium)]">Pendentes de Aprovação</p>
                  <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{formatHours(totalPending)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[#4A7C4E]/10">
                  <CheckCircle className="h-6 w-6 text-[#4A7C4E]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--color-brown-medium)]">Horas Aprovadas</p>
                  <p className="text-2xl font-bold text-[#4A7C4E]">{formatHours(totalApproved)}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Team Members */}
          {teamMembers.length === 0 ? (
            <Card className="p-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-[var(--color-brown-medium)] opacity-50" />
              <p className="text-[var(--color-brown-medium)]">Nenhum colaborador sob sua supervisão</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {teamMembers.map((member) => {
                const progress = getProgressPct(member.total_worked_hours, member.expected_monthly_hours);
                const isLoading = actionLoading === member.user_id;
                const hasExtra = member.total_overtime_hours > 0;

                return (
                  <Card key={member.user_id} className="p-6">
                    {/* Member header row */}
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-lg font-semibold text-[var(--color-brown-dark)]">{member.user_name}</h3>
                          {getStatusBadge(member.status)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[var(--color-brown-medium)]">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {member.schedule_name}
                          </span>
                          <span>·</span>
                          <span>{member.daily_hours}h/dia úteis</span>
                          {member.department && (
                            <>
                              <span>·</span>
                              <span>{member.department}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Monthly expected vs worked */}
                      <div className="lg:w-48">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[var(--color-brown-medium)]">Meta do mês</span>
                          <span className="font-medium text-[var(--color-brown-dark)]">
                            {formatHours(member.total_worked_hours)} / {formatHours(member.expected_monthly_hours)}
                          </span>
                        </div>
                        <div className="w-full bg-[var(--color-cream)] rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full progress-bar"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: progress >= 100 ? "var(--color-gold)" : "#C4883A",
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Hours breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div className="bg-[var(--color-cream)] rounded-xl p-3 text-center">
                        <p className="text-xs text-[var(--color-brown-medium)] mb-1">Trabalhadas</p>
                        <p className="text-base font-bold text-[var(--color-brown-dark)]">{formatHours(member.total_worked_hours)}</p>
                      </div>
                      <div className="bg-[var(--color-cream)] rounded-xl p-3 text-center">
                        <p className="text-xs text-[var(--color-brown-medium)] mb-1">Extras Feitas</p>
                        <p className="text-base font-bold text-[#C4883A]">{formatHours(member.total_overtime_hours)}</p>
                      </div>
                      <div className="bg-[var(--color-cream)] rounded-xl p-3 text-center">
                        <p className="text-xs text-[var(--color-brown-medium)] mb-1">Aprovadas</p>
                        <p className="text-base font-bold text-[#4A7C4E]">{formatHours(member.approved_overtime_hours)}</p>
                      </div>
                      <div className="bg-[var(--color-cream)] rounded-xl p-3 text-center">
                        <p className="text-xs text-[var(--color-brown-medium)] mb-1">Pendentes</p>
                        <p className="text-base font-bold text-[#C4883A]">{formatHours(member.overtime_pending_approval)}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-row lg:flex-row gap-2">
                      {member.status === "open" && hasExtra && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => doAction(member, "approve_all")}
                            disabled={isLoading}
                          >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            Aprovar Todas
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => doAction(member, "reject_all")}
                            disabled={isLoading}
                          >
                            <XCircle className="h-4 w-4" />
                            Rejeitar Todas
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetails(member)}
                      >
                        <Eye className="h-4 w-4" />
                        Ver Detalhes
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={selectedMember ? `${selectedMember.user_name} — ${format(currentDate, "MMMM yyyy", { locale: ptBR })}` : "Detalhes"}
        size="lg"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-gold)" }} />
          </div>
        ) : detailEntries.length === 0 ? (
          <div className="text-center py-10 text-[var(--color-brown-medium)]">
            <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum registro de ponto neste mês</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {/* Summary bar */}
            {selectedMember && (
              <div className="grid grid-cols-4 gap-2 pb-3 border-b border-[var(--border)] mb-2">
                {[
                  { label: "Trabalhadas", value: formatHours(selectedMember.total_worked_hours), color: "var(--color-brown-dark)" },
                  { label: "Extras", value: formatHours(selectedMember.total_overtime_hours), color: "#C4883A" },
                  { label: "Aprovadas", value: formatHours(selectedMember.approved_overtime_hours), color: "#4A7C4E" },
                  { label: "Pendentes", value: formatHours(selectedMember.overtime_pending_approval), color: "#C4883A" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <p className="text-xs text-[var(--color-brown-medium)]">{label}</p>
                    <p className="text-sm font-bold" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {detailEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-white hover:bg-[var(--color-cream)] transition-colors"
              >
                {/* Date + times */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-brown-dark)] capitalize">
                    {format(new Date(entry.date + "T00:00:00"), "EEE, dd 'de' MMM", { locale: ptBR })}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-brown-medium)] mt-0.5">
                    <Clock className="h-3 w-3" />
                    <span>{fmtTime(entry.clock_in)} → {fmtTime(entry.clock_out)}</span>
                    {entry.lunch_start && entry.lunch_end && (
                      <>
                        <span className="opacity-50">|</span>
                        <span>Almoço {fmtTime(entry.lunch_start)}–{fmtTime(entry.lunch_end)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Hours */}
                <div className="text-right mr-2 shrink-0">
                  <p className="text-sm font-semibold text-[var(--color-brown-dark)]">{formatHours(entry.total_hours)}</p>
                  <p className={`text-xs font-medium ${entry.overtime_hours > 0 ? "text-[#C4883A]" : "text-[var(--color-brown-medium)]"}`}>
                    +{formatHours(entry.overtime_hours)} extra
                  </p>
                </div>

                {/* Per-day actions */}
                {selectedMember?.status === "open" && entry.overtime_hours > 0 ? (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleApproveDay(entry.id)}
                      className="p-1.5 rounded-lg bg-[#4A7C4E]/10 hover:bg-[#4A7C4E]/20 text-[#4A7C4E] transition-colors"
                      title="Aprovar este dia"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleRejectDay(entry.id)}
                      className="p-1.5 rounded-lg bg-[#A65D4E]/10 hover:bg-[#A65D4E]/20 text-[#A65D4E] transition-colors"
                      title="Rejeitar este dia"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ) : entry.overtime_hours > 0 ? (
                  <span className="text-xs text-[var(--color-brown-medium)] shrink-0">
                    {selectedMember?.status === "approved" ? "✓ Aprovado" : "✗ Rejeitado"}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
