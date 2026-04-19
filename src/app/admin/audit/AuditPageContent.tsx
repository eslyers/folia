"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui";
import { Search, Download, FileText, User, Settings, Calendar, Clock } from "lucide-react";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_value: any;
  new_value: any;
  created_at: string;
  profile_name?: string;
}

interface ProfileData {
  id: string;
  role: string;
  name?: string;
  email?: string;
  [key: string]: any;
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  APPROVE: "bg-green-100 text-green-800",
  REJECT: "bg-red-100 text-red-800",
  CREATE: "bg-green-100 text-green-800",
};

const TABLE_ICONS: Record<string, any> = {
  leave_requests: Calendar,
  profiles: User,
  policies: Settings,
  hour_entries: Clock,
};

export default function AuditPageContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTable, setFilterTable] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single() as { data: ProfileData | null };

      if (!profileData || profileData.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      setProfile(profileData);
      await fetchLogs();
    };

    checkAuth();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data: logsData, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch profile names for user_ids
      const userIds = [...new Set(logsData?.map((l: any) => l.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);

      const profileMap: Record<string, string> = {};
      profiles?.forEach((p: any) => {
        profileMap[p.id] = p.name;
      });

      const logsWithNames = (logsData || []).map((log: any) => ({
        ...log,
        profile_name: profileMap[log.user_id] || "Sistema",
      }));

      setLogs(logsWithNames);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    const actionUpper = action.toUpperCase();
    return ACTION_COLORS[actionUpper] || "bg-gray-100 text-gray-800";
  };

  const getTableIcon = (tableName: string) => {
    return TABLE_ICONS[tableName] || FileText;
  };

  const formatValue = (value: any): string => {
    if (!value) return "-";
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = searchTerm === "" ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.profile_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.record_id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTable = filterTable === "all" || log.table_name === filterTable;
    const matchesAction = filterAction === "all" || log.action === filterAction;

    return matchesSearch && matchesTable && matchesAction;
  });

  const uniqueTables = [...new Set(logs.map((l) => l.table_name))];
  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--cream)]">
        <p className="text-[var(--brown-medium)]">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Header profile={profile} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
            📋 Histórico de Alterações
          </h1>
          <p className="text-[var(--brown-medium)] mt-2">
            Acompanhe todas as alterações no sistema
          </p>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por ação, tabela, usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
              />
            </div>
            <select
              value={filterTable}
              onChange={(e) => setFilterTable(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
            >
              <option value="all">Todas as tabelas</option>
              {uniqueTables.map((table) => (
                <option key={table} value={table}>
                  {table}
                </option>
              ))}
            </select>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
            >
              <option value="all">Todas as ações</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Logs List */}
        <Card className="p-6 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-gold)] mx-auto"></div>
              <p className="mt-4 text-[var(--brown-medium)]">Carregando logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-[var(--brown-medium)]">Nenhum registro encontrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log) => {
                const IconComponent = getTableIcon(log.table_name);
                return (
                  <div
                    key={log.id}
                    className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-[var(--color-cream)] rounded-lg">
                          <IconComponent className="h-5 w-5 text-[var(--color-brown)]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                              {log.action}
                            </span>
                            <span className="text-sm text-[var(--brown-medium)]">
                              em <strong>{log.table_name}</strong>
                            </span>
                            <span className="text-xs text-gray-400">
                              ID: {log.record_id.slice(0, 8)}...
                            </span>
                          </div>
                          <p className="text-sm text-[var(--brown)] mt-1">
                            Por: <strong>{log.profile_name}</strong>
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {(log.old_value || log.new_value) && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {log.old_value && (
                          <div className="bg-red-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-red-700 mb-1">Valor Anterior:</p>
                            <pre className="text-xs text-red-600 whitespace-pre-wrap break-all">
                              {formatValue(log.old_value)}
                            </pre>
                          </div>
                        )}
                        {log.new_value && (
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-green-700 mb-1">Novo Valor:</p>
                            <pre className="text-xs text-green-600 whitespace-pre-wrap break-all">
                              {formatValue(log.new_value)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
