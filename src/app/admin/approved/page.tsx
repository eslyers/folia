"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Building2, X, ChevronDown, Check, Search, Calendar, Filter } from "lucide-react";
import { Card, Button, PremiumSelect } from "@/components/ui";
import { useTenant } from "@/contexts/TenantContext";
import { isTenantAdmin, isMasterAdmin, canManageTeam, getHomeRoute } from "@/lib/auth";
import { format } from "date-fns";
import { LEAVE_TYPE_LABELS, STATUS_LABELS, LeaveType } from "@/lib/types";
import { clsx } from "clsx";

export default function ApprovedRequestsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { currentTenant, setCurrentTenant, tenants, isLoading: tenantLoading } = useTenant();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [processing, setProcessing] = useState<string | null>(null);
  const [cancellingRequest, setCancellingRequest] = useState<any>(null);

  const fetchData = async (tenantId: string | null) => {
    // Build requests query - only approved
    let requestsQuery = supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "approved")
      .order("reviewed_at", { ascending: false });

    if (tenantId) {
      requestsQuery = requestsQuery.eq("tenant_id", tenantId);
    }

    const { data: requestsData } = await requestsQuery;

    // Build profiles query
    let profilesQuery = supabase.from("profiles").select("*").order("name");
    if (tenantId) {
      profilesQuery = profilesQuery.eq("tenant_id", tenantId);
    }
    const { data: profilesData } = await profilesQuery;

    setRequests(requestsData || []);
    setProfiles(profilesData || []);
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profileData || !canManageTeam(profileData.role)) {
        router.push(getHomeRoute(profileData?.role));
        return;
      }

      setProfile(profileData);
      setLoading(false);
    };

    checkUser();
  }, []);

  useEffect(() => {
    if (profile) {
      const tenantToFetch = currentTenant?.id || profile.tenant_id;
      if (tenantToFetch) {
        fetchData(tenantToFetch);
      } else if (isMasterAdmin(profile.role)) {
        fetchData(null);
      }
    }
  }, [profile, currentTenant]);

  const getUserName = (userId: string) => {
    const user = profiles.find((p) => p.id === userId);
    return user?.name || "-";
  };

  const handleCancel = async () => {
    if (!cancellingRequest) return;

    setProcessing(cancellingRequest.id);

    try {
      // Return balance if it was vacation
      if (cancellingRequest.type === "vacation") {
        const { error: rpcError } = await (supabase as any).rpc("add_vacation_balance", {
          p_user_id: cancellingRequest.user_id,
          p_days: cancellingRequest.days_count,
        });

        if (rpcError) {
          alert("Falha ao devolver saldo. Tente novamente.");
          setProcessing(null);
          setCancellingRequest(null);
          return;
        }
      }

      // Update request status to cancelled
      const { error: updateError } = await supabase
        .from("leave_requests")
        .update({
          status: "cancelled",
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
          cancellation_reason: "Cancelado pelo gestor",
        })
        .eq("id", cancellingRequest.id);

      if (updateError) {
        alert("Erro ao cancelar: " + updateError.message);
      } else {
        // Refresh data
        const tenantToFetch = currentTenant?.id || profile.tenant_id;
        fetchData(tenantToFetch);
      }
    } catch (err: any) {
      alert("Erro: " + err.message);
    } finally {
      setProcessing(null);
      setCancellingRequest(null);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const userName = getUserName(r.user_id).toLowerCase();
      const matchesSearch = userName.includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || r.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [requests, searchQuery, typeFilter, profiles]);

  const typeOptions = [
    { value: "all", label: "Todos os tipos" },
    { value: "vacation", label: "Férias" },
    { value: "day_off", label: "Folga" },
    { value: "hours", label: "Banco de Horas" },
    { value: "sick", label: "Médico" },
    { value: "other", label: "Outro" },
  ];

  if (loading || tenantLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--cream)]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--brown-medium)]">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      {/* Tenant Selector for Master Admin */}
      {isMasterAdmin(profile?.role) && tenants.length > 0 && (
        <div className="bg-white border-b border-[var(--border)] px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <label className="text-sm font-medium text-[var(--color-brown-dark)]">
              Filtrar por empresa:
            </label>
            <div className="relative">
              <button
                onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white hover:border-[#5C724A] transition-colors min-w-[200px]"
              >
                <Building2 className="h-4 w-4 text-[#5C724A]" />
                <span className="flex-1 text-sm text-[var(--color-brown-dark)] text-left">
                  {currentTenant?.name || "Todas as empresas"}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${tenantDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {tenantDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Empresas</p>
                  </div>
                  <button
                    onClick={() => { setCurrentTenant(null); setTenantDropdownOpen(false); }}
                    className={clsx(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors",
                      !currentTenant && "bg-[#5C724A]/5 text-[#5C724A]"
                    )}
                  >
                    <span className="flex-1">Todas as empresas</span>
                  </button>
                  {tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => { setCurrentTenant(tenant); setTenantDropdownOpen(false); }}
                      className={clsx(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors",
                        currentTenant?.id === tenant.id && "bg-[#5C724A]/5 text-[#5C724A]"
                      )}
                    >
                      <Building2 className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 truncate">{tenant.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--color-brown-dark)]">
              Aprovações Realizadas
            </h1>
            <p className="text-sm text-[var(--color-brown-medium)] mt-1">
              Visualize e gerencie todas as aprovações de férias e folgas
            </p>
          </div>

          {/* Filters */}
          <Card className="p-4 mb-6">
            <div className="flex flex-wrap gap-4 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por funcionário..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[var(--color-brown-dark)] placeholder:text-gray-400 text-sm"
                />
              </div>

              {/* Type Filter */}
              <PremiumSelect
                icon={<Filter className="h-4 w-4" />}
                value={typeFilter}
                onChange={(val) => setTypeFilter(val)}
                options={typeOptions}
                placeholder="Tipo de solicitação"
              />

              {/* Count */}
              <span className="text-sm text-[var(--color-brown-medium)]">
                {filteredRequests.length} aprovação(ções)
              </span>
            </div>
          </Card>

          {/* Requests List */}
          {filteredRequests.length === 0 ? (
            <Card className="p-12 text-center">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-[var(--color-brown-medium)]">Nenhuma aprovação encontrada</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-[var(--border)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Funcionário</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Período</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Dias</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Aprovado em</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-medium text-[var(--color-brown-dark)] text-sm">
                            {getUserName(request.user_id)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            "inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-0.5",
                            request.type === "vacation" && "bg-blue-100 text-blue-800",
                            request.type === "day_off" && "bg-purple-100 text-purple-800",
                            request.type === "sick" && "bg-red-100 text-red-800",
                            request.type === "hours" && "bg-yellow-100 text-yellow-800",
                            request.type === "other" && "bg-gray-100 text-gray-800"
                          )}>
                            {(LEAVE_TYPE_LABELS[request.type as LeaveType] || request.type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-brown-dark)]">
                          {format(new Date(request.start_date), "dd/MM/yyyy")} - {format(new Date(request.end_date), "dd/MM/yyyy")}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-brown-dark)]">
                          {request.days_count} dia(s)
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-brown-medium)]">
                          {request.reviewed_at ? format(new Date(request.reviewed_at), "dd/MM/yyyy HH:mm") : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="danger"
                            size="sm"
                            loading={processing === request.id}
                            onClick={() => setCancellingRequest(request)}
                          >
                            <X className="h-4 w-4" />
                            Cancelar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {cancellingRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-4">
              Cancelar Aprovação
            </h3>
            <p className="text-sm text-[var(--color-brown-medium)] mb-4">
              Tem certeza que deseja cancelar a aprovação de <strong>{getUserName(cancellingRequest.user_id)}</strong>?
              <br /><br />
              {cancellingRequest.type === "vacation" && (
                <>Isso irá <strong>devolver {cancellingRequest.days_count} dia(s)</strong> ao saldo de férias.</>
              )}
              {cancellingRequest.type !== "vacation" && (
                <>Esta ação não pode ser desfeita.</>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setCancellingRequest(null)}>
                Voltar
              </Button>
              <Button variant="danger" loading={processing !== null} onClick={handleCancel}>
                Confirmar Cancelamento
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
