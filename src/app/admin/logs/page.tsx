"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isMasterAdmin } from "@/lib/auth";
import { Card, Button, Input } from "@/components/ui";
import { Scroll, Download, Search, Filter, X, ChevronLeft, ChevronRight, LogIn, LogOut, Plus, Pencil, Trash2, CheckCircle, XCircle, Clock } from "lucide-react";

interface LogEntry {
  id: string;
  tenant_id: string;
  user_id: string;
  action: string;
  module: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  login: LogIn,
  logout: LogOut,
  create: Plus,
  update: Pencil,
  delete: Trash2,
  approve: CheckCircle,
  reject: XCircle,
  default: Clock,
};

const MODULE_LABELS: Record<string, string> = {
  auth: "Autenticação",
  users: "Usuários",
  employees: "Funcionários",
  leave_requests: "Pedidos de Férias",
  schedules: "Escalas",
  timesheets: "Fechamento",
  tenants: "Empresas",
  webhooks: "Webhooks",
  settings: "Configurações",
  finance: "Financeiro",
  system: "Sistema",
};

const ACTION_LABELS: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  create: "Criou",
  update: "Atualizou",
  delete: "Excluiu",
  approve: "Aprovou",
  reject: "Rejeitou",
};

function getActionIcon(action: string) {
  return ACTION_ICONS[action.toLowerCase()] ?? ACTION_ICONS.default;
}

export default function LogsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

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
      .single() as { data: any };
    if (!profileData || !isMasterAdmin(profileData.role)) {
      router.push("/dashboard");
      return;
    }
    setProfile(profileData);
    await loadLogs();
    setLoading(false);
  };

  const loadLogs = async () => {
    const { data, error } = await (supabase as any)
      .from("system_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Error loading logs:", error);
      setLogs([]);
    } else {
      setLogs(data || []);
    }
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...logs];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.action?.toLowerCase().includes(term) ||
          log.module?.toLowerCase().includes(term) ||
          log.details?.toLowerCase().includes(term) ||
          log.user_name?.toLowerCase().includes(term) ||
          log.user_email?.toLowerCase().includes(term) ||
          log.ip_address?.toLowerCase().includes(term)
      );
    }

    if (filterAction) {
      filtered = filtered.filter((log) => log.action === filterAction);
    }

    if (filterModule) {
      filtered = filtered.filter((log) => log.module === filterModule);
    }

    if (filterDate) {
      filtered = filtered.filter((log) => log.created_at.startsWith(filterDate));
    }

    setTotalCount(filtered.length);
    setFilteredLogs(filtered.slice(0, currentPage * pageSize));
  }, [logs, searchTerm, filterAction, filterModule, filterDate, currentPage]);

  const clearFilters = () => {
    setSearchTerm("");
    setFilterAction("");
    setFilterModule("");
    setFilterDate("");
    setCurrentPage(1);
  };

  const exportCSV = async () => {
    setExportLoading(true);
    const headers = ["Timestamp", "Usuário", "Email", "Ação", "Módulo", "Detalhes", "IP"];
    const rows = filteredLogs.map((log) => [
      log.created_at,
      log.user_name || "",
      log.user_email || "",
      log.action,
      log.module,
      (log.details || "").replace(/"/g, '""'),
      log.ip_address || "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-folia-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportLoading(false);
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasMore = filteredLogs.length < totalCount;

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-cream)]">
        <div className="text-center">
          <div style={{ width: "48px", height: "48px", border: "4px solid var(--color-gold)", borderTop: "4px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "var(--brown-medium)" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8 animate-fade-in-up">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)] flex items-center gap-2">
              📜 Logs de Sistema
            </h1>
            <p className="text-[var(--color-brown-medium)] mt-1">
              {totalCount.toLocaleString("pt-BR")} registros — últimos 500 eventos
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpar Filtros
            </Button>
            <Button variant="primary" size="sm" onClick={exportCSV} loading={exportLoading}>
              <Download className="h-4 w-4 mr-1" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-brown-medium)]" />
              <input
                type="text"
                placeholder="Buscar em logs..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
              />
            </div>
            <select
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
            >
              <option value="">Todas ações</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="create">Criar</option>
              <option value="update">Atualizar</option>
              <option value="delete">Excluir</option>
              <option value="approve">Aprovar</option>
              <option value="reject">Rejeitar</option>
            </select>
            <select
              value={filterModule}
              onChange={(e) => { setFilterModule(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
            >
              <option value="">Todos módulos</option>
              {Object.entries(MODULE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
            />
          </div>
        </Card>

        {/* Logs Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-cream)] text-left">
                  <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs">Timestamp</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs">Usuário</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs">Ação</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs">Módulo</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs">Detalhes</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[var(--color-brown-medium)]">
                      <Scroll className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>Nenhum log encontrado</p>
                      {logs.length === 0 && (
                        <p className="text-xs mt-1 text-[var(--color-brown-light)]">
                          Nenhum registro no banco. Execute a migration de logs primeiro.
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const Icon = getActionIcon(log.action);
                    return (
                      <tr key={log.id} className="hover:bg-[var(--color-cream)]/50 transition-colors">
                        <td className="px-4 py-3 text-[var(--color-brown-dark)] whitespace-nowrap">
                          <span className="font-mono text-xs">
                            {new Date(log.created_at).toLocaleString("pt-BR")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-[var(--color-brown-dark)]">{log.user_name || "—"}</p>
                            <p className="text-xs text-[var(--color-brown-medium)]">{log.user_email || ""}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-4 w-4 text-[var(--color-gold)]" />
                            <span className="font-medium text-[var(--color-brown-dark)]">
                              {ACTION_LABELS[log.action.toLowerCase()] ?? log.action}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-[var(--color-cream)] px-2 py-0.5 text-xs font-medium text-[var(--color-brown-medium)]">
                            {MODULE_LABELS[log.module.toLowerCase()] ?? log.module}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-brown-medium)] max-w-xs truncate" title={log.details || ""}>
                          {log.details || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-[var(--color-brown-medium)]">{log.ip_address || "—"}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--color-cream)]">
              <p className="text-xs text-[var(--color-brown-medium)]">
                Mostrando {filteredLogs.length} de {totalCount.toLocaleString("pt-BR")} registros
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs px-2 py-1 font-medium">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={!hasMore}
                  className="p-1.5 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}