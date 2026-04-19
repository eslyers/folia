"use client";

import { useState, Component, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Calendar as CalendarIcon, Clock, Palette } from "lucide-react";
import { Card, Button } from "@/components/ui";
import { Calendar } from "@/components/calendar/Calendar";
import { LeaveRequestModal } from "@/components/LeaveRequestModal";
import { HoursBankSection } from "@/components/HoursBankSection";
import { LEAVE_TYPE_LABELS, STATUS_LABELS } from "@/lib/types";
import type { Profile, LeaveRequest, HourEntry } from "@/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Error Boundary to prevent white screens
class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-[var(--color-cream)]">
            <div className="text-center p-8">
              <h2 className="text-2xl font-bold text-[var(--color-brown-dark)] mb-4">
                Ops! Algo deu errado
              </h2>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[var(--color-gold)] text-[var(--color-brown-dark)] rounded-lg hover:bg-[var(--color-gold-vivid)] transition-folia"
              >
                Recarregar página
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

interface EmployeeDashboardProps {
  onRefresh?: () => void;
  profile: Profile;
  leaveRequests: LeaveRequest[];
  hourEntries?: HourEntry[];
}

export function EmployeeDashboard({ profile, leaveRequests, onRefresh, hourEntries = [] }: EmployeeDashboardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "hours">("overview");
  const router = useRouter();

  const myApprovedLeaves = leaveRequests.filter((r) => r.status === "approved");

  const handleSuccess = () => {
    if (onRefresh) { onRefresh(); } else {
    router.refresh(); }
  };

  // Safe name extraction with fallback
  const firstName = profile?.name ? profile.name.split(" ")[0] : "Usuário";

  // Safe date formatting with error handling
  const getNextLeaveDate = () => {
    try {
      if (myApprovedLeaves.length === 0) return null;
      const sorted = [...myApprovedLeaves].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );
      if (!sorted[0]?.start_date) return null;
      return format(new Date(sorted[0].start_date), "dd/MM");
    } catch {
      return null;
    }
  };

  const nextLeaveDate = getNextLeaveDate();
  const nextLeaveType = (() => {
    try {
      if (myApprovedLeaves.length === 0) return null;
      const sorted = [...myApprovedLeaves].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );
      return sorted[0]?.type || null;
    } catch {
      return null;
    }
  })();

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-[var(--background)]">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
            Olá, {firstName}! 👋
          </h1>
          <p className="text-[var(--color-brown-medium)] mt-1">
            Aqui está o resumo das suas folgas
          </p>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Card hoverable className="animate-fade-in-up" style={{ animationDelay: "50ms" }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[var(--color-brown-medium)] mb-1">Férias restantes</p>
                <p className="text-4xl font-bold text-[var(--color-green-olive)]">
                  {profile?.vacation_balance ?? 0}
                </p>
                <p className="text-xs text-[var(--color-brown-medium)] mt-1">dias disponíveis</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[var(--color-green-olive)]/10 flex items-center justify-center">
                <Palette className="h-6 w-6 text-[var(--color-green-olive)]" />
              </div>
            </div>
          </Card>

          <Card hoverable className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[var(--color-brown-medium)] mb-1">Banco de Horas</p>
                <p className="text-4xl font-bold text-[var(--color-gold)]">
                  {Math.floor((profile?.hours_balance ?? 0) / 60)}h
                </p>
                <p className="text-xs text-[var(--color-brown-medium)] mt-1">
                  {(profile?.hours_balance ?? 0) % 60}m acumuladas
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[var(--color-gold)]/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-[var(--color-gold)]" />
              </div>
            </div>
          </Card>

          <Card hoverable className="animate-fade-in-up" style={{ animationDelay: "150ms" }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[var(--color-brown-medium)] mb-1">Próxima Folga</p>
                <p className="text-2xl font-bold text-[var(--color-green-olive)]">
                  {nextLeaveDate || "Nenhuma"}
                </p>
                <p className="text-xs text-[var(--color-brown-medium)] mt-1">
                  {nextLeaveType
                    ? nextLeaveType === "vacation"
                      ? "Férias agendadas"
                      : "Folga agendada"
                    : "agendada"}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[var(--color-green-olive)]/10 flex items-center justify-center">
                <CalendarIcon className="h-6 w-6 text-[var(--color-green-olive)]" />
              </div>
            </div>
          </Card>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-6 animate-fade-in-up" style={{ animationDelay: "180ms" }}>
          <Button
            size="sm"
            variant={activeTab === "overview" ? "primary" : "secondary"}
            onClick={() => setActiveTab("overview")}
          >
            <CalendarIcon className="h-4 w-4 mr-1" />
            Visão Geral
          </Button>
          <Button
            size="sm"
            variant={activeTab === "hours" ? "primary" : "secondary"}
            onClick={() => setActiveTab("hours")}
          >
            <Clock className="h-4 w-4 mr-1" />
            Banco de Horas
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" ? (
          <>
            {/* CTA */}
            <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
              <Button size="lg" onClick={() => setModalOpen(true)}>
                <Plus className="h-5 w-5 mr-2" />
                Solicitar Folga
              </Button>
            </div>

            {/* Calendar + Recent Requests */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Calendar */}
              <Card className="animate-fade-in-up" style={{ animationDelay: "250ms" }}>
                <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] mb-6">
                  Calendário de Folgas
                </h2>
                <Calendar
                  leaveRequests={myApprovedLeaves || []}
                  showNavigation
                />
              </Card>

              {/* Recent Requests */}
              <Card className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
                <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] mb-6">
                  Meus Pedidos
                </h2>
                {!leaveRequests || leaveRequests.length === 0 ? (
                  <div className="text-center py-12 text-[var(--color-brown-medium)]">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum pedido de folga ainda</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModalOpen(true)}
                      className="mt-4"
                    >
                      Fazer primeiro pedido
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {leaveRequests.slice(0, 5).map((request) => {
                      let startStr = "--/--";
                      let endStr = "--/--";
                      try {
                        startStr = format(new Date(request.start_date), "dd/MM/yyyy", { locale: ptBR });
                      } catch {}
                      try {
                        endStr = format(new Date(request.end_date), "dd/MM/yyyy", { locale: ptBR });
                      } catch {}
                      return (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] hover:bg-[var(--color-cream)] transition-folia"
                        >
                          <div>
                            <p className="font-medium text-[var(--color-brown-dark)]">
                              {LEAVE_TYPE_LABELS[request.type] || request.type}
                            </p>
                            <p className="text-sm text-[var(--color-brown-medium)]">
                              {startStr} → {endStr}
                            </p>
                            <p className="text-xs text-[var(--color-brown-medium)] mt-1">
                              {request.days_count || 0} dia{(request.days_count || 0) > 1 ? "s" : ""}
                            </p>
                          </div>
                          <span className={`inline-flex items-center rounded-full border border-transparent text-xs font-semibold px-2.5 py-0.5 ${request.status === "approved" ? "bg-green-100 text-green-800" : request.status === "pending" ? "bg-yellow-100 text-yellow-800" : request.status === "rejected" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>
                            {STATUS_LABELS[request.status] || request.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </>
        ) : (
          <div className="animate-fade-in-up">
            <HoursBankSection
              userId={profile?.id}
              initialEntries={hourEntries}
              onBalanceChange={onRefresh}
            />
          </div>
        )}
      </main>

      <LeaveRequestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
    </ErrorBoundary>
  );
}