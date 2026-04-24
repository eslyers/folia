"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui";

import { Play, Mail, CheckCircle, XCircle, AlertCircle, Bell, Send, X, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface NotificationLog {
  id: string;
  user_id: string;
  type: string;
  status: "sent" | "failed";
  message: string;
  email_sent: boolean;
  error?: string;
  created_at: string;
  user_name?: string;
}

interface NotificationStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

// Toast Component
function Toast({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-20 right-4 z-[9999] animate-slide-in-right ${
      toast.type === "success" ? "bg-green-50 border-green-200" :
      toast.type === "error" ? "bg-red-50 border-red-200" :
      "bg-blue-50 border-blue-200"
    } border rounded-xl shadow-xl p-4 max-w-md`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${
          toast.type === "success" ? "bg-green-100" :
          toast.type === "error" ? "bg-red-100" :
          "bg-blue-100"
        }`}>
          {toast.type === "success" ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : toast.type === "error" ? (
            <XCircle className="h-5 w-5 text-red-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-blue-600" />
          )}
        </div>
        <div className="flex-1">
          <p className={`font-medium ${
            toast.type === "success" ? "text-green-800" :
            toast.type === "error" ? "text-red-800" :
            "text-blue-800"
          }`}>
            {toast.type === "success" ? "Sucesso!" : toast.type === "error" ? "Erro!" : "Info"}
          </p>
          <p className={`text-sm mt-1 ${
            toast.type === "success" ? "text-green-700" :
            toast.type === "error" ? "text-red-700" :
            "text-blue-700"
          }`}>
            {toast.message}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-black/5 rounded-lg transition-colors"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>
    </div>
  );
}

// Toast Container
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </>
  );
}

export default function NotificationsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<NotificationStats>({ total: 0, sent: 0, failed: 0, pending: 0 });
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [showItemsDropdown, setShowItemsDropdown] = useState(false);

  // Pagination helpers
  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const paginatedLogs = logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const showToast = (type: Toast["type"], message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const supabase = createClient();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      loadData();
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: logsData, error } = await supabase
        .from("notification_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading logs:", error);
        throw error;
      }

      // Get user profiles for names
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name");

      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p.name]));
      
      // Map logs with user names
      const typedLogs = (logsData as any[]) || [];
      const logsWithNames = typedLogs.map((log: any) => ({
        ...log,
        user_name: profileMap.get(log.user_id) || "Usuário"
      }));

      const total = logsWithNames.length || 0;
      const sent = logsWithNames.filter((log: any) => log.status === "sent").length || 0;
      const failed = logsWithNames.filter((log: any) => log.status === "failed").length || 0;

      setStats({ total, sent, failed, pending: 0 });
      setLogs(logsWithNames);
    } catch (error) {
      console.error("Error loading data:", error);
      // Set empty state on error
      setStats({ total: 0, sent: 0, failed: 0, pending: 0 });
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotifications = async () => {
    setSending(true);
    try {
      const response = await fetch("/api/test-notifications");
      const data = await response.json();

      if (!data.success) {
        showToast("error", "Erro ao criar notificações: " + (data.error || "Erro desconhecido"));
        return;
      }

      const sendResponse = await fetch("/api/send-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.notifications),
      });

      const sendResult = await sendResponse.json();
      
      if (sendResult.success) {
        showToast("success", "Notificações de teste enviadas com sucesso!");
        // Wait a bit for DB insert to complete, then reload
        setTimeout(() => loadData(), 1000);
      } else {
        showToast("error", "Erro ao enviar notificações: " + (sendResult.error || "Erro desconhecido"));
      }
    } catch (error) {
      console.error("Error:", error);
      showToast("error", "Erro ao enviar notificações: " + error);
    } finally {
      setSending(false);
    }
  };

  const checkAndSendNotifications = async () => {
    setSending(true);
    try {
      const checkResponse = await fetch("/api/check-notifications");
      const checkData = await checkResponse.json();

      if (!checkData.success) {
        showToast("error", "Erro ao verificar: " + (checkData.error || "Erro desconhecido"));
        return;
      }

      if (checkData.notifications && checkData.notifications.length > 0) {
        const sendResponse = await fetch("/api/send-notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(checkData.notifications),
        });

        const sendResult = await sendResponse.json();
        
        if (sendResult.success) {
          showToast("success", `Enviadas ${checkData.notifications.length} notificações com sucesso!`);
          // Wait a bit for DB insert to complete, then reload
          setTimeout(() => loadData(), 1000);
        } else {
          showToast("error", "Erro ao enviar notificações: " + (sendResult.error || "Erro desconhecido"));
        }
      } else {
        showToast("info", "Nenhuma notificação pendente encontrada.");
      }
    } catch (error) {
      console.error("Error:", error);
      showToast("error", "Erro ao verificar notificações: " + error);
    } finally {
      setSending(false);
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      upcoming_leave: "🏖️ Férias Próximas",
      expiring_leave: "⏰ Férias Terminando",
      approval_approved: "✅ Aprovado",
      approval_rejected: "❌ Rejeitado",
      vacation_vesting_1: "⏰ 1ª Férias Vencendo",
      vacation_expired_1: "🚨 1ª Férias Vencidas",
      vacation_mark_2: "📅 Marcar 2ª Férias",
      vacation_mark_2_urgent: "🚨 Marcar 2ª URGENTE",
      vacation_expired_2: "🚨 2ª Férias Vencidas",
      vacation_no_hire_date: "⚠️ Sem Data Admissão",
    };
    return labels[type] || type;
  };

  const getNotificationTypeColor = (type: string) => {
    switch (type) {
      case "vacation_expired_1":
      case "vacation_expired_2":
      case "vacation_mark_2_urgent":
      case "vacation_no_hire_date":
        return "bg-red-100 text-red-800 border-red-300";
      case "vacation_vesting_1":
      case "vacation_mark_2":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "approval_rejected":
        return "bg-red-50 text-red-700 border-red-200";
      case "approval_approved":
        return "bg-green-100 text-green-800 border-green-300";
      case "upcoming_leave":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "expiring_leave":
        return "bg-amber-100 text-amber-800 border-amber-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--color-brown-medium)]">Carregando notificações...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    <div className="min-h-screen bg-[var(--background)]">
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 shadow-lg">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
                Notificações
              </h1>
              <p className="text-[var(--color-brown-medium)]">
                Gerenciar sistema de notificações por email
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total */}
          <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-5 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-brown-medium)]">Total</p>
                <p className="text-3xl font-bold text-[var(--color-brown-dark)] mt-1">{stats.total}</p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--color-cream)]">
                <Mail className="h-6 w-6 text-[var(--color-brown-dark)]" />
              </div>
            </div>
          </div>

          {/* Enviadas */}
          <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-5 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-brown-medium)]">Enviadas</p>
                <p className="text-3xl font-bold text-[var(--color-green-emerald)] mt-1">{stats.sent}</p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--color-cream)]">
                <CheckCircle className="h-6 w-6 text-[var(--color-green-emerald)]" />
              </div>
            </div>
          </div>

          {/* Falhas */}
          <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-5 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-brown-medium)]">Falhas</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{stats.failed}</p>
              </div>
              <div className="p-3 rounded-xl bg-red-50">
                <XCircle className="h-6 w-6 text-red-500" />
              </div>
            </div>
          </div>

          {/* Pendentes */}
          <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-5 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-brown-medium)]">Pendentes</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
              </div>
              <div className="p-3 rounded-xl bg-yellow-50">
                <AlertCircle className="h-6 w-6 text-yellow-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-6 mb-8">
          <h3 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-4 flex items-center gap-2">
            <Send className="h-5 w-5 text-[var(--color-gold)]" />
            Ações
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              onClick={checkAndSendNotifications}
              disabled={sending}
              className="h-12 px-6 bg-[var(--color-brown-dark)] hover:bg-[var(--color-brown-medium)] text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Play className="h-4 w-4" />
              <span>{sending ? "Verificando..." : "Verificar & Enviar Notificações"}</span>
            </Button>

            <Button
              onClick={sendTestNotifications}
              disabled={sending}
              className="h-12 px-6 bg-[var(--color-gold)] hover:bg-[var(--color-gold-vivid)] text-[var(--color-brown-dark)] font-medium shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Mail className="h-4 w-4" />
              <span>{sending ? "Enviando..." : "Testar Notificações"}</span>
            </Button>
          </div>

          <p className="text-sm text-[var(--color-brown-medium)] mt-4 text-center">
            💡 Sistema verifica automaticamente: 1ª férias (3 meses antes/vencida), 2ª férias (6/3 meses), férias próximas (7 dias), término (3 dias).
          </p>
        </div>

        {/* Logs */}
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] bg-gradient-to-r from-[var(--color-cream)] to-white">
            <h3 className="text-lg font-semibold text-[var(--color-brown-dark)] flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-[var(--color-gold)]" />
              Logs de Notificações
            </h3>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-4 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[var(--color-brown-medium)]">Carregando logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-[var(--color-cream)] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell className="h-8 w-8 text-[var(--color-brown-medium)]" />
                </div>
                <p className="text-[var(--color-brown-medium)]">Nenhum log de notificação encontrado.</p>
                <p className="text-sm text-[var(--color-brown-medium)] mt-1">Teste o sistema usando os botões acima.</p>
              </div>
            ) : (
              <>
              <div className="space-y-3">
                {paginatedLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] hover:bg-[var(--color-cream)] transition-colors duration-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg bg-[var(--color-cream)] ${getNotificationTypeColor(log.type)}`}>
                        {log.status === "sent" ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--color-brown-dark)]">
                          {log.user_name || "Usuário"}
                        </p>
                        <p className="text-sm text-[var(--color-brown-medium)]">
                          {getNotificationTypeLabel(log.type)} - {log.message}
                        </p>
                        {log.error && (
                          <p className="text-xs text-red-500 mt-1">❌ Erro: {log.error}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getNotificationTypeColor(log.type)}`}>
                        {getNotificationTypeLabel(log.type)}
                      </span>
                      <p className="text-xs text-[var(--color-brown-medium)] mt-1">
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {logs.length > itemsPerPage && (
                <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-[var(--border)]">
                  {/* Items per page selector - Custom Premium Dropdown */}
                  <div className="flex items-center gap-2 relative">
                    <span className="text-sm text-[var(--color-brown-medium)]">Exibir:</span>
                    <button
                      onClick={() => setShowItemsDropdown(!showItemsDropdown)}
                      className="flex items-center gap-2 bg-white border border-[var(--color-gold)] rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-brown-dark)] shadow-sm hover:shadow-md transition-all min-w-[80px] justify-between z-30"
                    >
                      <span>{itemsPerPage}</span>
                      <ChevronRight className="h-4 w-4 text-[var(--color-gold)] rotate-90" />
                    </button>
                    
                    {showItemsDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowItemsDropdown(false)} />
                        <div className="absolute top-full left-0 mt-2 bg-white border-2 border-[var(--color-gold)] rounded-xl shadow-2xl z-50 overflow-visible min-w-[100px]">
                          {[10, 20, 30, 50, 100].map((num) => (
                            <button
                              key={num}
                              onClick={() => {
                                setItemsPerPage(num);
                                setCurrentPage(1);
                                setShowItemsDropdown(false);
                              }}
                              className={`w-full px-4 py-2.5 text-sm text-left transition-all first:rounded-t-xl last:rounded-b-xl ${
                                num === itemsPerPage 
                                  ? "bg-[var(--color-gold)] text-[var(--color-brown-dark)] font-semibold" 
                                  : "text-[var(--color-brown-dark)] hover:bg-[var(--color-gold)]/20"
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <span className="text-sm text-[var(--color-brown-medium)]">itens</span>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 h-9 border-[var(--border)] hover:border-[var(--color-gold)] hover:bg-[var(--color-gold)]/10"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <span className="text-sm font-medium text-[var(--color-brown-dark)] px-3">
                      {currentPage} / {totalPages}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 h-9 border-[var(--border)] hover:border-[var(--color-gold)] hover:bg-[var(--color-gold)]/10"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              </>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-6 bg-gradient-to-r from-[var(--color-cream)] to-white rounded-xl border border-[var(--border)] shadow-sm">
          <h4 className="font-semibold text-[var(--color-brown-dark)] mb-4 flex items-center gap-2">
            <span className="text-xl">📧</span>
            Sistema de Notificações - Tipos de Alerta
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
              <h5 className="font-medium text-green-800 mb-2">✅ Aprovação</h5>
              <p className="text-sm text-green-700">Notifica quando um pedido é aprovado</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
              <h5 className="font-medium text-red-800 mb-2">❌ Rejeição</h5>
              <p className="text-sm text-red-700">Notifica quando um pedido é rejeitado</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
              <h5 className="font-medium text-blue-800 mb-2">🏖️ Férias Próximas</h5>
              <p className="text-sm text-blue-700">Enviado 7 dias antes do início</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg border-l-4 border-amber-500">
              <h5 className="font-medium text-amber-800 mb-2">⏰ Férias Terminando</h5>
              <p className="text-sm text-amber-700">Enviado 3 dias antes do fim</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
              <h5 className="font-medium text-orange-800 mb-2">⏰ 1ª Férias Vencendo</h5>
              <p className="text-sm text-orange-700">Enviado 3 meses antes do vencimento</p>
            </div>
            <div className="bg-red-100 p-4 rounded-lg border-l-4 border-red-600">
              <h5 className="font-medium text-red-900 mb-2">🚨 1ª Férias Vencidas</h5>
              <p className="text-sm text-red-800">Quando vence sem gozo - PRIORIDADE MÁXIMA</p>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-500">
              <h5 className="font-medium text-indigo-800 mb-2">📅 Marcar 2ª Férias</h5>
              <p className="text-sm text-indigo-700">Enviado 6 meses antes (se não programada)</p>
            </div>
            <div className="bg-yellow-100 p-4 rounded-lg border-l-4 border-yellow-600">
              <h5 className="font-medium text-yellow-900 mb-2">🚨 Marcar 2ª Férias URGENTE</h5>
              <p className="text-sm text-yellow-800">Enviado 3 meses antes (se não programada)</p>
            </div>
            <div className="bg-red-100 p-4 rounded-lg border-l-4 border-red-600 md:col-span-2">
              <h5 className="font-medium text-red-900 mb-2">⚠️ Sem Data de Admissão</h5>
              <p className="text-sm text-red-800">Funcionário com férias mas sem data de admissão - NÃO RASTREÁVEL</p>
            </div>
          </div>
        </div>
      </main>
    </div>
    </>
  );
}