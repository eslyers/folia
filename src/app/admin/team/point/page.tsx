"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Users, Clock, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

import { Card, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { format, addMonths, subMonths, getDaysInMonth, startOfMonth } from "date-fns";
import { isTenantAdmin } from "@/lib/auth";
import { ptBR } from "date-fns/locale";

interface TimeEntry {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  total_hours: string | number;
  overtime_hours: string | number;
  status: "open" | "closed" | "adjustment";
  profile?: {
    id: string;
    name: string;
    email: string;
    department?: string | null;
    schedule?: {
      id: string;
      name: string;
      daily_hours: number;
    } | null;
  };
}

interface Stats {
  total_employees: number;
  total_hours: number;
  total_overtime: number;
  pending_approval: number;
  total_expected_hours: number;
}

export default function AdminTeamPointPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [stats, setStats] = useState<Stats>({
    total_employees: 0,
    total_hours: 0,
    total_overtime: 0,
    pending_approval: 0,
    total_expected_hours: 0,
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const supabase = createClient();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

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
      if (!adminProfile || !isTenantAdmin(adminProfile.role)) {
        setTimeout(() => router.push("/dashboard"), 1500);
        return;
      }

      setProfile(adminProfile);

      const response = await fetch(`/api/point/admin/overview?year=${year}&month=${month}`, {
        headers: {
          ...(session?.access_token && { "Authorization": `Bearer ${session.access_token}` }),
        },
      });
      const data = await response.json();

      if (response.ok) {
        setEntries(data.entries || []);
        setStats(data.stats || {
          total_employees: 0,
          total_hours: 0,
          total_overtime: 0,
          pending_approval: 0,
          total_expected_hours: 0,
        });
      } else {
        console.error("Failed to fetch point data:", data.error);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching data:", err);
      setLoading(false);
    }
  }, [router, supabase, year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePrevMonth = () => setCurrentDate((d) => subMonths(d, 1));
  const handleNextMonth = () => setCurrentDate((d) => addMonths(d, 1));

  // Calculate expected monthly hours based on schedule
  const calculateExpectedHours = (schedule: any, targetYear: number, targetMonth: number) => {
    if (!schedule) return 0;
    const daysInMonth = getDaysInMonth(new Date(targetYear, targetMonth - 1));
    const monthStart = startOfMonth(new Date(targetYear, targetMonth - 1));
    let workDays = 0;

    for (let day = 0; day < daysInMonth; day++) {
      const date = new Date(monthStart);
      date.setDate(day + 1);
      const dow = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const dayMap: Record<number, keyof Pick<typeof schedule, 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'>> = {
        0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday'
      };
      if (schedule[dayMap[dow]]) {
        workDays++;
      }
    }

    return parseFloat(String(schedule.daily_hours || 8)) * workDays;
  };

  const handleExportCSV = () => {
    const headers = ["Funcionário", "Departamento", "Escala", "Horas/Dia", "Data", "Entrada", "Saída", "Total (h)", "Extra (h)", "Status"];
    const rows = entries.map((e) => [
      e.profile?.name || "-",
      e.profile?.department || "-",
      e.profile?.schedule?.name || "-",
      e.profile?.schedule?.daily_hours?.toFixed(2) || "-",
      e.date,
      e.clock_in || "-",
      e.clock_out || "-",
      e.total_hours || "0",
      e.overtime_hours || "0",
      e.status,
    ]);

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ponto_${year}_${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (t: string | null) => t ? t.slice(0, 5) : "-";
  const formatHours = (h: string | number | null) => h ? parseFloat(String(h)).toFixed(2) : "0.00";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "closed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#4A7C4E]/10 text-[#4A7C4E]">
            <CheckCircle className="h-3 w-3" /> Fechado
          </span>
        );
      case "open":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#C4883A]/10 text-[#C4883A]">
            <AlertCircle className="h-3 w-3" /> Aberto
          </span>
        );
      case "adjustment":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            Ajuste
          </span>
        );
      default:
        return null;
    }
  };

  const monthLabel = format(currentDate, "MMMM yyyy", { locale: ptBR });
  const displayMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--color-cream)" }}>
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
          <p style={{ color: "var(--color-brown-medium)" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
              Controle de Ponto 👁️
            </h1>
            <p className="text-[var(--color-brown-medium)] mt-1">
              Registro de ponto de todos os funcionários
            </p>
          </div>

          <Button variant="secondary" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Month Selector */}
        <Card className="p-4 mb-6 flex items-center justify-between">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-[var(--color-cream)] transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-[var(--color-brown-medium)]" />
          </button>

          <h2 className="text-lg font-semibold text-[var(--color-brown-dark)]">
            {displayMonth}
          </h2>

          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-[var(--color-cream)] transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-[var(--color-brown-medium)]" />
          </button>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-50">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-brown-medium)]">Funcionários</p>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{stats.total_employees}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[var(--color-green-olive)]/10">
                <Clock className="h-6 w-6 text-[var(--color-green-olive)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-brown-medium)]">Total Horas</p>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{formatHours(stats.total_hours)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-50">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-brown-medium)]">Hora Extra</p>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{formatHours(stats.total_overtime)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-50">
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-brown-medium)]">Pendentes</p>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{stats.pending_approval}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-50">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-brown-medium)]">Esperadas</p>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{formatHours(stats.total_expected_hours)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Entries Table */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] mb-4">
            Registros do Mês
          </h2>

          {entries.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-brown-medium)]">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum registro de ponto para este mês</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-3 text-sm font-medium text-[var(--color-brown-medium)]">Funcionário</th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-[var(--color-brown-medium)]">Departamento</th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-[var(--color-brown-medium)]">Escala</th>
                    <th className="text-center py-3 px-3 text-sm font-medium text-[var(--color-brown-medium)]">H/Dia</th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-[var(--color-brown-medium)]">Data</th>
                    <th className="text-center py-3 px-3 text-sm font-medium text-[var(--color-brown-medium)]">Entrada</th>
                    <th className="text-center py-3 px-3 text-sm font-medium text-[var(--color-brown-medium)]">Saída</th>
                    <th className="text-center py-3 px-3 text-sm font-medium text-[var(--color-brown-medium)]">Almoço</th>
                    <th className="text-center py-3 px-3 text-sm font-medium text-[var(--color-brown-medium)]">Total</th>
                    <th className="text-center py-3 px-3 text-sm font-medium text-[var(--color-brown-medium)]">Extra</th>
                    <th className="text-center py-3 px-3 text-sm font-medium text-[var(--color-brown-medium)]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-[var(--border)] hover:bg-[var(--color-cream)]">
                      <td className="py-3 px-3">
                        <div>
                          <p className="font-medium text-[var(--color-brown-dark)]">{entry.profile?.name || "-"}</p>
                          <p className="text-xs text-[var(--color-brown-medium)]">{entry.profile?.email || ""}</p>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <p className="text-sm text-[var(--color-brown-medium)]">{entry.profile?.department || "-"}</p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="text-sm text-[var(--color-brown-dark)]">{entry.profile?.schedule?.name || "-"}</p>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <p className="text-sm text-[var(--color-brown-dark)] font-mono">
                          {entry.profile?.schedule ? `${entry.profile.schedule.daily_hours.toFixed(2)}h` : "-"}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="text-sm text-[var(--color-brown-dark)]">
                          {new Date(entry.date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <p className="text-sm text-[var(--color-brown-dark)] font-mono">{formatTime(entry.clock_in)}</p>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <p className="text-sm text-[var(--color-brown-dark)] font-mono">{formatTime(entry.clock_out)}</p>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <p className="text-xs text-[var(--color-brown-medium)] font-mono">
                          {entry.lunch_start && entry.lunch_end ? `${formatTime(entry.lunch_start)}-${formatTime(entry.lunch_end)}` : "-"}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <p className="text-sm font-semibold text-[var(--color-brown-dark)]">{formatHours(entry.total_hours)}h</p>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <p className={`text-sm font-semibold ${parseFloat(String(entry.overtime_hours || 0)) > 0 ? "text-amber-600" : "text-[var(--color-brown-medium)]"}`}>
                          {formatHours(entry.overtime_hours)}h
                        </p>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {getStatusBadge(entry.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
