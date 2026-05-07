"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Button } from "@/components/ui";
import { LeaveRequestModal } from "@/components/LeaveRequestModal";
import { LEAVE_TYPE_LABELS, STATUS_LABELS } from "@/lib/types";
import type { Profile, LeaveRequest } from "@/lib/types";
import { Calendar as CalendarIcon, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DashboardMyRequestsClient() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchMyData = useCallback(async () => {
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

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileError || !profileData) {
        setLoading(false);
        return;
      }

      // Se for admin/gestor, manda pro fluxo correto
      if ((profileData as any).role === "master_admin" || (profileData as any).role === "tenant_admin" || (profileData as any).role === "gestor") {
        router.push("/admin/my-requests");
        return;
      }

      const { data: requests, error: requestsError } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (requestsError) {
        setLoading(false);
        return;
      }

      setProfile(profileData as any);
      setMyRequests((requests || []) as any);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    fetchMyData();
  }, [fetchMyData]);

  const firstName = useMemo(() => profile?.name?.split(" ")[0] || "Usuário", [profile?.name]);

  const handleSuccess = () => fetchMyData();

  const handleCancel = async (requestId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("leave_requests")
        .update({ status: "cancelled" })
        .eq("id", requestId);

      if (!error) {
        setMyRequests((prev) => prev.map((r) => (r.id === requestId ? ({ ...r, status: "cancelled" } as any) : r)));
      }
    } catch {
      // noop
    }
  };

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
            margin: "0 auto 16px",
          }} />
          <p style={{ color: "var(--brown-medium)" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
            Meus Pedidos, {firstName}! 👋
          </h1>
          <p className="text-[var(--color-brown-medium)] mt-1">Aqui estão suas solicitações de folga</p>
        </div>

        <div className="mb-6">
          <Button size="lg" onClick={() => setModalOpen(true)}>
            <Plus className="h-5 w-5 mr-2" />
            Solicitar Folga
          </Button>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] mb-6">Meus Pedidos</h2>

          {!myRequests || myRequests.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-brown-medium)]">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum pedido de folga ainda</p>
              <Button variant="ghost" size="sm" onClick={() => setModalOpen(true)} className="mt-4">
                Fazer primeiro pedido
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {myRequests.map((request) => {
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
                    <div className="flex items-center gap-2">
                      {request.status === "pending" && (
                        <Button variant="ghost" size="sm" onClick={() => handleCancel(request.id)}>
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full border border-transparent text-xs font-semibold px-2.5 py-0.5 ${
                          request.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : request.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : request.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {STATUS_LABELS[request.status] || request.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </main>

      <LeaveRequestModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSuccess={handleSuccess} isAdmin={false} />
    </div>
  );
}

