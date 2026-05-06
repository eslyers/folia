"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Button } from "@/components/ui";
import { useTenant } from "@/contexts/TenantContext";
import { isGestor, isTenantAdmin } from "@/lib/auth";
import { format } from "date-fns";
import { LEAVE_TYPE_LABELS, LeaveType } from "@/lib/types";
import { Calendar } from "@/components/calendar/Calendar";
import { Check, X, Clock, Users, AlertCircle } from "lucide-react";

export default function TeamOverviewPage() {
  const router = useRouter();
  const supabase = createClient();
  const { currentTenant } = useTenant();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchData = async () => {
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
      router.push("/dashboard");
      return;
    }

    if (!isGestor(profileData.role) && !isTenantAdmin(profileData.role)) {
      router.push("/dashboard");
      return;
    }

    setProfile(profileData);

    // Fetch requests for the team (only pending for gestores to approve)
    let requestsQuery = supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (currentTenant?.id) {
      requestsQuery = requestsQuery.eq("tenant_id", currentTenant.id);
    } else if (profileData.tenant_id) {
      requestsQuery = requestsQuery.eq("tenant_id", profileData.tenant_id);
    }

    const { data: requestsData } = await requestsQuery;

    // Fetch profiles for the team
    let profilesQuery = supabase.from("profiles").select("*").order("name");
    if (currentTenant?.id) {
      profilesQuery = profilesQuery.eq("tenant_id", currentTenant.id);
    } else if (profileData.tenant_id) {
      profilesQuery = profilesQuery.eq("tenant_id", profileData.tenant_id);
    }

    const { data: profilesData } = await profilesQuery;

    setRequests(requestsData || []);
    setProfiles(profilesData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentTenant]);

  const getUserName = (userId: string) => {
    const user = profiles.find((p) => p.id === userId);
    return user?.name || "-";
  };

  const pendingRequests = useMemo(() => 
    requests.filter((r) => r.status === "pending"), 
    [requests]
  );

  const handleApprove = async (requestId: string, userId: string) => {
    setProcessing(requestId);
    try {
      // Get user's vacation balance
      const userProfile = profiles.find((p) => p.id === userId);
      const request = requests.find((r) => r.id === requestId);
      
      if (!request || !userProfile) {
        setProcessing(null);
        return;
      }

      // Deduct vacation balance if vacation type
      if (request.type === "vacation") {
        await (supabase as any).rpc("deduct_vacation_balance", {
          p_user_id: userId,
          p_days: request.days_count,
          p_expected_balance: userProfile.vacation_balance || 0,
        });
      }

      // Update request status
      const { error: updateError } = await supabase
        .from("leave_requests")
        .update({
          status: "approved",
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (!updateError) {
        // Refresh data
        fetchData();
      }
    } catch (err) {
      console.error("Error approving:", err);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { error: updateError } = await supabase
        .from("leave_requests")
        .update({
          status: "rejected",
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (!updateError) {
        fetchData();
      }
    } catch (err) {
      console.error("Error rejecting:", err);
    } finally {
      setProcessing(null);
    }
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

  return (
    <div className="min-h-screen bg-[var(--cream)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-brown-dark)]">
            Minha Equipe
          </h1>
          <p className="text-sm text-[var(--color-brown-medium)] mt-1">
            Acompanhe as férias e folgas da sua equipe
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-yellow-50">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-brown-medium)]">Pendentes</p>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">
                  {pendingRequests.length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-50">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-brown-medium)]">Aprovados</p>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">
                  {requests.filter((r) => r.status === "approved").length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-50">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-brown-medium)]">Equipe</p>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">
                  {profiles.length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Calendar */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-4">
            Calendário da Equipe
          </h2>
          <Calendar 
            leaveRequests={requests.filter(r => r.status === "approved" || r.status === "pending")} 
            profiles={profiles} 
            size="full" 
          />
        </Card>

        {/* Pending Requests */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            Pedidos Pendentes
          </h2>

          {pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-brown-medium)]">
              <p>Nenhum pedido pendente de aprovação</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 bg-[var(--color-cream)] rounded-lg flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-[var(--color-brown-dark)]">
                        {getUserName(request.user_id)}
                      </p>
                      <span className={`inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-0.5 ${
                        request.type === "vacation" ? "bg-blue-100 text-blue-800" :
                        request.type === "day_off" ? "bg-purple-100 text-purple-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {LEAVE_TYPE_LABELS[request.type as LeaveType] || request.type}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5">
                        Pendente
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-brown-medium)]">
                      {format(new Date(request.start_date), "dd/MM/yyyy")} - {format(new Date(request.end_date), "dd/MM/yyyy")}
                      • {request.days_count} dia(s)
                    </p>
                    {request.notes && (
                      <p className="text-xs text-[var(--color-brown-medium)] mt-1 italic">
                        "{request.notes}"
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="success"
                      size="sm"
                      loading={processing === request.id}
                      onClick={() => handleApprove(request.id, request.user_id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={processing === request.id}
                      onClick={() => handleReject(request.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
