"use client";

import { useState, Component, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Users, Calendar as CalendarIcon, Clock, AlertCircle, CheckSquare, Square } from "lucide-react";
import { Card, Button, Modal } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { LEAVE_TYPE_LABELS, STATUS_LABELS } from "@/lib/types";
import type { Profile, LeaveRequest } from "@/lib/types";
import { format } from "date-fns";
import { getRoleLabel } from "@/lib/auth";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/calendar/Calendar";

// M9: ErrorBoundary to prevent white screens
class AdminErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }> {
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

interface AdminDashboardProps {
  profile: Profile;
  leaveRequests: LeaveRequest[];
  profiles: Profile[];
  selectedTenantId?: string;
}

export function AdminDashboard({ profile, leaveRequests, profiles, selectedTenantId }: AdminDashboardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [requests, setRequests] = useState(leaveRequests);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [cancellingRequest, setCancellingRequest] = useState<{id: string, userId: string, userName: string, type: string, days: number} | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "name",
    direction: "asc",
  });

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedRequests = requests.filter((r) => r.status === "approved");


  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };


  const sortedProfiles = [...profiles].sort((a, b) => {
    const aVal = a[sortConfig.key as keyof typeof a] ?? "";
    const bVal = b[sortConfig.key as keyof typeof b] ?? "";
    const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortConfig.direction === "asc" ? comparison : -comparison;
  });

  const handleApprove = async (requestId: string, userId: string) => {
    setProcessing(requestId);
    setError(null);

    try {
      // Get request details
      const request = requests.find(r => r.id === requestId);
      if (!request) {
        setError("Pedido não encontrado");
        setProcessing(null);
        return;
      }

      // Prevent self-approval (H1)
      if (userId === profile.id) {
        setError("Você não pode aprovar seu próprio pedido");
        setProcessing(null);
        return;
      }

      // C2: Atomic update using RPC if vacation
      // Get user's vacation_balance from local profiles array instead of request.profile (avoids RLS issues)
      const userProfile = profiles.find((p) => p.id === userId);
      if (request.type === "vacation") {
        const { error: rpcError } = (supabase as any).rpc("deduct_vacation_balance", {
          p_user_id: userId,
          p_days: request.days_count,
          p_expected_balance: userProfile?.vacation_balance || 0,
        });

        if (rpcError) {
          setError("Falha ao atualizar saldo. Tente novamente.");
          setProcessing(null);
          return;
        }
      }

      // Update request status
      const { error: updateError } = await (supabase as any)
        .from("leave_requests")
        .update({
          status: "approved",
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateError) {
        setError(updateError.message);
      } else {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === requestId ? { ...r, status: "approved" as const } : r
          )
        );
      }
    } catch (e: any) {
      setError(e.message || "Erro ao aprovar pedido");
    } finally {
      setProcessing(null);
    }
  };

  const handleCancel = (requestId: string, userId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (!request) return;
    
    const userName = getUserName(userId);
    setCancellingRequest({
      id: requestId,
      userId,
      userName,
      type: request.type,
      days: request.days_count
    });
  };

  const confirmCancel = async () => {
    if (!cancellingRequest) return;
    
    setProcessing(cancellingRequest.id);
    setError(null);

    try {
      // Return balance if it was vacation
      if (cancellingRequest.type === "vacation") {
        const { error: rpcError } = await (supabase as any).rpc("add_vacation_balance", {
          p_user_id: cancellingRequest.userId,
          p_days: cancellingRequest.days,
        });

        if (rpcError) {
          setError("Falha ao devolver saldo. Tente novamente.");
          setProcessing(null);
          return;
        }
      }

      // Update request status
      const { error: updateError } = await (supabase as any)
        .from("leave_requests")
        .update({
          status: "cancelled",
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
          cancellation_reason: "Cancelado pelo gestor",
        })
        .eq("id", cancellingRequest.id);

      if (updateError) {
        setError(updateError.message);
      } else {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === cancellingRequest.id ? { ...r, status: "cancelled" as const } : r
          )
        );
        setCancellingRequest(null);
      }
    } catch (e: any) {
      setError(e.message || "Erro ao cancelar pedido");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = (requestId: string) => {
    setRejectingRequestId(requestId);
    setRejectionReason("");
    setError(null);
  };

  const confirmReject = async () => {
    if (!rejectingRequestId) return;
    setProcessing(rejectingRequestId);
    setError(null);

    try {
      const { error: updateError } = await (supabase as any)
        .from("leave_requests")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason.trim() || null,
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", rejectingRequestId);

      if (updateError) {
        setError(updateError.message);
      } else {
        // Send rejection email notification
        const request = requests.find((r) => r.id === rejectingRequestId);
        const userProfile = profiles.find((p) => p.id === request?.user_id);
        if (request && userProfile) {
          try {
            await fetch("/api/send-notifications", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify([{
                user_id: userProfile.id,
                user_name: userProfile.name,
                user_email: userProfile.email,
                type: "approval_rejected",
                title: `❌ Pedido de ${LEAVE_TYPE_LABELS[request.type]} Rejeitado`,
                message: `Seu pedido de ${LEAVE_TYPE_LABELS[request.type]} foi rejeitado.`,
                leave_start: request.start_date,
                leave_end: request.end_date,
                notes: rejectionReason.trim() || "Motivo não informado",
                rejection_reason: rejectionReason.trim() || null,
              }]),
            });
          } catch (emailErr) {
            console.error("[Admin] Failed to send rejection email:", emailErr);
          }
        }

        setRequests((prev) =>
          prev.map((r) =>
            r.id === rejectingRequestId ? { ...r, status: "rejected" as const, rejection_reason: rejectionReason.trim() || null } : r
          )
        );
        setRejectingRequestId(null);
        setRejectionReason("");
      }
    } catch (e: any) {
      setError(e.message || "Erro ao rejeitar pedido");
    } finally {
      setProcessing(null);
    }
  };

  const getUserName = (userId: string) => {
    const user = profiles.find((p) => p.id === userId);
    return user?.name || "Usuário";
  };

  const toggleSelect = (requestId: string) => {
    setSelectedRequestIds((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRequestIds.size === pendingRequests.length) {
      setSelectedRequestIds(new Set());
    } else {
      setSelectedRequestIds(new Set(pendingRequests.map((r) => r.id)));
    }
  };

  const bulkApprove = async () => {
    if (selectedRequestIds.size === 0) return;
    setBulkProcessing(true);
    setError(null);

    let approved = 0;
    let failed = 0;

    for (const requestId of selectedRequestIds) {
      const request = requests.find((r) => r.id === requestId);
      if (!request) { failed++; continue; }

      // Prevent self-approval
      if (request.user_id === profile.id) { failed++; continue; }

      const userProfile = profiles.find((p) => p.id === request.user_id);

      try {
        if (request.type === "vacation") {
          await (supabase as any).rpc("deduct_vacation_balance", {
            p_user_id: request.user_id,
            p_days: request.days_count,
            p_expected_balance: userProfile?.vacation_balance || 0,
          });
        }

        const { error } = await (supabase as any)
          .from("leave_requests")
          .update({
            status: "approved",
            reviewed_by: profile.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", requestId);

        if (!error) approved++;
        else failed++;
      } catch {
        failed++;
      }
    }

    if (approved > 0) {
      setRequests((prev) =>
        prev.map((r) =>
          selectedRequestIds.has(r.id) ? { ...r, status: "approved" as const } : r
        )
      );
    }

    setSelectedRequestIds(new Set());
    setBulkProcessing(false);
    if (failed > 0) setError(`${approved} aprovado(s), ${failed} falha(s)`);
  };

  const bulkReject = () => {
    // If only one selected, use the single modal
    if (selectedRequestIds.size === 1) {
      const [firstId] = selectedRequestIds;
      setRejectingRequestId(firstId);
      setRejectionReason("");
      setSelectedRequestIds(new Set());
    }
  };

  return (
    <AdminErrorBoundary>
    <div className="min-h-screen bg-[var(--background)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* Welcome */}
        <div className="mb-8 animate-slide-up">
          {/* Title removed - Sidebar already shows current page */}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-50">
                <Clock className="h-6 w-6 text-[var(--color-warning)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-brown-medium)]">Pendentes</p>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{pendingRequests.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-50">
                <Check className="h-6 w-6 text-[var(--color-success)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-brown-medium)]">Aprovados</p>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{approvedRequests.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-50">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-brown-medium)]">Funcionários</p>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{profiles.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-50">
                <CalendarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-brown-medium)]">Total Pedidos</p>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{requests.length}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Pending Requests */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-[var(--color-warning)]" />
                  Pedidos Pendentes
                  {pendingRequests.length > 0 && (
                    <span className="inline-flex items-center rounded-full border border-transparent bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5">{pendingRequests.length}</span>
                  )}
                </h2>
                {pendingRequests.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 text-sm text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)] transition-folia"
                  >
                    {selectedRequestIds.size === pendingRequests.length ? (
                      <><CheckSquare className="h-4 w-4 text-[var(--color-gold)]" /> Desmarcar todos</>
                    ) : (
                      <><Square className="h-4 w-4" /> Selecionar todos</>
                    )}
                  </button>
                )}
              </div>

              {/* Bulk Action Bar */}
              {selectedRequestIds.size > 0 && (
                <div className="mb-4 p-3 rounded-xl bg-[var(--color-cream)] border border-[var(--color-gold)] flex items-center justify-between gap-3 animate-slide-up">
                  <span className="text-sm font-medium text-[var(--color-brown-dark)]">
                    {selectedRequestIds.size} selecionado{selectedRequestIds.size > 1 ? "s" : ""}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      loading={bulkProcessing}
                      onClick={bulkApprove}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Aprovar ({selectedRequestIds.size})
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={bulkReject}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Rejeitar ({selectedRequestIds.size})
                    </Button>
                  </div>
                </div>
              )}

              {pendingRequests.length === 0 ? (
                <div className="text-center py-12 text-[var(--color-brown-medium)]">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum pedido pendente</p>
                  <p className="text-sm mt-1">Todos os pedidos foram processados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className={`p-4 rounded-xl border transition-folia flex items-start gap-3 ${selectedRequestIds.has(request.id) ? "border-[var(--color-gold)] bg-[var(--color-cream)]" : "border-[var(--border)] hover:border-[var(--color-gold)]"}`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSelect(request.id)}
                        className="mt-0.5 flex-shrink-0 text-[var(--color-brown-medium)] hover:text-[var(--color-gold)] transition-folia"
                      >
                        {selectedRequestIds.has(request.id) ? (
                          <CheckSquare className="h-5 w-5 text-[var(--color-gold)]" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-[var(--color-brown-dark)]">
                              {getUserName(request.user_id)}
                            </p>
                            <span className="inline-flex items-center rounded-full border border-transparent bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5">{LEAVE_TYPE_LABELS[request.type]}</span>
                          </div>
                          <div className="text-right text-sm text-[var(--color-brown-medium)]">
                            <p>{format(new Date(request.start_date), "dd/MM/yyyy", { locale: ptBR })}</p>
                            <p>→ {format(new Date(request.end_date), "dd/MM/yyyy", { locale: ptBR })}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[var(--color-brown-medium)]">
                            {request.days_count} dia{request.days_count > 1 ? "s" : ""}
                            {request.notes && (
                              <span className="ml-2 text-xs">• &quot;{request.notes}&quot;</span>
                            )}
                          </span>

                          <div className="flex gap-2">
                            <Button
                              variant="danger"
                              size="sm"
                              loading={processing === request.id}
                              onClick={() => handleReject(request.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              loading={processing === request.id}
                              onClick={() => handleApprove(request.id, request.user_id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Approved Requests */}
          <div>
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] mb-4 flex items-center gap-2">
                <Check className="h-5 w-5 text-[var(--color-success)]" />
                Aprovados Recentes
              </h2>

              {approvedRequests.length === 0 ? (
                <div className="text-center py-8 text-[var(--color-brown-medium)]">
                  <p className="text-sm">Nenhum pedido aprovado ainda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {approvedRequests.slice(0, 10).map((request) => (
                    <div
                      key={request.id}
                      className="p-3 rounded-lg bg-[var(--color-cream)] flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-[var(--color-brown-dark)] text-sm">
                            {getUserName(request.user_id)}
                          </p>
                          <span className="inline-flex items-center rounded-full border border-transparent bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5">Aprovado</span>
                        </div>
                        <p className="text-xs text-[var(--color-brown-medium)]">
                          {format(new Date(request.start_date), "dd/MM")} - {format(new Date(request.end_date), "dd/MM")}
                          • {request.days_count} dias
                        </p>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={processing === request.id}
                        onClick={() => handleCancel(request.id, request.user_id)}
                        title="Cancelar solicitação"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Team Overview */}
        <Card className="p-6 mt-8">
          <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] mb-4">
            Visão Geral da Equipe
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th 
                    className="text-left py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)] cursor-pointer hover:text-[var(--color-gold)]"
                    onClick={() => handleSort("name")}
                  >
                    Funcionário {sortConfig.key === "name" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th 
                    className="text-center py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)] cursor-pointer hover:text-[var(--color-gold)]"
                    onClick={() => handleSort("vacation_balance")}
                  >
                    Férias {sortConfig.key === "vacation_balance" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th 
                    className="text-center py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)] cursor-pointer hover:text-[var(--color-gold)]"
                    onClick={() => handleSort("hours_balance")}
                  >
                    Banco de Horas {sortConfig.key === "hours_balance" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th 
                    className="text-center py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)] cursor-pointer hover:text-[var(--color-gold)]"
                    onClick={() => handleSort("position")}
                  >
                    Classificação {sortConfig.key === "position" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedProfiles.map((p) => {
                  const userRequests = requests.filter(r => r.user_id === p.id);
                  const approvedCount = userRequests.filter(r => r.status === "approved").length;
                  return (
                    <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--color-cream)]">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-[var(--color-brown-dark)]">{p.name}</p>
                          <p className="text-xs text-[var(--color-brown-medium)]">{p.email}</p>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="text-lg font-semibold text-[var(--color-gold)]">
                          {p.vacation_balance}
                        </span>
                        <span className="text-xs text-[var(--color-brown-medium)]"> dias</span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="text-lg font-semibold text-[var(--color-green-olive)]">
                          {p.hours_balance}
                        </span>
                        <span className="text-xs text-[var(--color-brown-medium)]"> hrs</span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="text-sm text-[var(--color-brown-dark)]">
                          {p.position || "-"}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className={`inline-flex items-center rounded-full border border-transparent text-xs font-semibold px-2.5 py-0.5 ${p.role === "master_admin" ? "bg-purple-100 text-purple-800" : p.role === "tenant_admin" ? "bg-blue-100 text-blue-800" : p.role === "gestor" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                          {getRoleLabel(p.role)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Calendar */}
        <Card className="p-6 mt-8">
          <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] mb-4 flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-[var(--color-gold)]" />
            Calendário de Eventos
          </h2>
          <div className="w-full">
            <Calendar leaveRequests={requests.filter(r => r.status === "approved" || r.status === "pending")} profiles={profiles} size="compact" />
          </div>
        </Card>
      </main>

      {/* Rejection Reason Modal */}
      <Modal
        isOpen={rejectingRequestId !== null}
        onClose={() => { setRejectingRequestId(null); setRejectionReason(""); }}
        title="Motivo da Rejeição"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-brown-medium)]">
            Informe o motivo da rejeição. O funcionário será notificado por email.
          </p>
          <div>
            <label
              htmlFor="rejection-reason"
              className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1"
            >
              Motivo <span className="text-[var(--color-error)]">*</span>
            </label>
            <textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex: Férias reprogramadas para maio. Por favor, refaça o pedido no novo período."
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--color-brown-dark)] placeholder-[var(--color-brown-medium)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-error)] focus:border-transparent resize-none"
              rows={4}
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-[var(--color-error)]">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => { setRejectingRequestId(null); setRejectionReason(""); }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={processing !== null}
              onClick={confirmReject}
            >
              Rejeitar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancellation Confirmation Modal */}
      <Modal
        isOpen={cancellingRequest !== null}
        onClose={() => setCancellingRequest(null)}
        title="Confirmar Cancelamento"
        size="sm"
      >
        {cancellingRequest && (
          <div className="space-y-4">
            <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-red-50 mb-4">
              <X className="h-8 w-8 text-[var(--color-error)]" />
            </div>
            <p className="text-sm text-[var(--color-brown-medium)] text-center mb-4">
              Deseja cancelar a solicitação de <span className="font-semibold text-[var(--color-brown-dark)]">{cancellingRequest.userName}</span>?
            </p>
            <div className="bg-[var(--color-cream)] rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-brown-medium)]">Tipo:</span>
                <span className="font-medium text-[var(--color-brown-dark)]">{cancellingRequest.type === "vacation" ? "Férias" : cancellingRequest.type === "day_off" ? "Folga" : cancellingRequest.type}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-brown-medium)]">Dias:</span>
                <span className="font-medium text-[var(--color-brown-dark)]">{cancellingRequest.days}</span>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                ⚠️ O saldo de férias será devolvido ao funcionário. Ele precisará fazer uma nova solicitação.
              </p>
            </div>
            {error && (
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setCancellingRequest(null)}
              >
                Voltar
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={processing !== null}
                onClick={confirmCancel}
              >
                Confirmar Cancelamento
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
    </AdminErrorBoundary>
  );
}