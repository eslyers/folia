"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Button } from "@/components/ui";
import {
  Clock,
  Coffee,
  Play,
  Square,
  CheckCircle,
  LogOut,
  Sunrise,
  Sunset,
} from "lucide-react";
import type { Profile } from "@/lib/types";

interface TimeEntry {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  total_hours: number | null;
  overtime_hours: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface WeekDayEntry {
  date: string;
  dayName: string;
  dayShort: string;
  totalHours: number | null;
  isToday: boolean;
  isFuture: boolean;
}

interface OvertimeData {
  total_overtime_hours: number;
  pending_hours: number;
  approved_hours: number;
  expected_monthly_hours: number;
  formatted: {
    total: string;
    pending: string;
    approved: string;
    expected: string;
  };
}

type ClockAction = "clock_in" | "lunch_start" | "lunch_end" | "clock_out";

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_NAMES_FULL = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

function getStatusInfo(entry: TimeEntry | null): {
  label: string;
  color: string;
  nextAction: ClockAction | null;
} {
  if (!entry) {
    return { label: "Aguardando entrada", color: "text-[var(--color-brown-medium)]", nextAction: "clock_in" };
  }
  if (entry.clock_out) {
    return { label: "Finalizado", color: "text-[var(--color-green-olive)]", nextAction: null };
  }
  if (entry.lunch_end) {
    return { label: "Em trabalho", color: "text-[var(--color-gold)]", nextAction: "clock_out" };
  }
  if (entry.lunch_start) {
    return { label: "Em almoço", color: "text-[var(--color-orange)]", nextAction: "lunch_end" };
  }
  if (entry.clock_in) {
    return { label: "Em trabalho", color: "text-[var(--color-gold)]", nextAction: "lunch_start" };
  }
  return { label: "Aguardando entrada", color: "text-[var(--color-brown-medium)]", nextAction: "clock_in" };
}

function getActionButton(action: ClockAction | null, onAction: (a: ClockAction) => void, isFinished: boolean): React.ReactElement | null {
  if (isFinished) {
    return (
      <Button disabled className="w-full py-4 text-lg opacity-60 cursor-not-allowed">
        <CheckCircle className="w-5 h-5 mr-2" />
        Dia encerrado
      </Button>
    );
  }

  const buttons: Record<ClockAction, React.ReactElement> = {
    clock_in: (
      <Button
        onClick={() => onAction("clock_in")}
        className="w-full py-4 text-lg bg-[var(--color-green-olive)] hover:bg-[var(--color-green-emerald)] text-white border-0"
      >
        <Sunrise className="w-5 h-5 mr-2" />
        Entrada
      </Button>
    ),
    lunch_start: (
      <Button
        onClick={() => onAction("lunch_start")}
        className="w-full py-4 text-lg bg-[var(--color-orange)] hover:opacity-90 text-white border-0"
      >
        <Coffee className="w-5 h-5 mr-2" />
        Iniciar Almoço
      </Button>
    ),
    lunch_end: (
      <Button
        onClick={() => onAction("lunch_end")}
        className="w-full py-4 text-lg bg-[var(--color-green-olive)] hover:bg-[var(--color-green-emerald)] text-white border-0"
      >
        <Play className="w-5 h-5 mr-2" />
        Voltar do Almoço
      </Button>
    ),
    clock_out: (
      <Button
        onClick={() => onAction("clock_out")}
        className="w-full py-4 text-lg bg-[var(--color-red)] hover:opacity-90 text-white border-0"
      >
        <Square className="w-5 h-5 mr-2" />
        Saída
      </Button>
    ),
  };

  return buttons[action!] ?? null;
}

function formatTime(time: string | null): string {
  if (!time) return "--:--";
  try {
    const [h, m] = time.split(":");
    return `${h}:${m}`;
  } catch {
    return "--:--";
  }
}

function formatHoursDisplay(h: number | null | undefined): string {
  if (h === null || h === undefined || isNaN(h as number)) return "-";
  const totalMinutes = Math.round((h as number) * 60);
  const hPart = Math.floor(totalMinutes / 60);
  const mPart = totalMinutes % 60;
  if (mPart === 0) return `${hPart}h`;
  return `${hPart}h ${mPart}m`;
}

export default function PointPageClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayEntry, setTodayEntry] = useState<TimeEntry | null>(null);
  const [weekEntries, setWeekEntries] = useState<WeekDayEntry[]>([]);
  const [overtime, setOvertime] = useState<OvertimeData | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [actionLoading, setActionLoading] = useState(false);
  const supabase = createClient();

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/login");
        return;
      }

      const userId = session.user.id;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (!profileData) {
        router.push("/login");
        return;
      }

      setProfile(profileData);

      const today = new Date().toISOString().split("T")[0];

      // Fetch today's entry
      const [todayRes, weekRes, otRes] = await Promise.all([
        fetch(`/api/point/entries?user_id=${userId}&date=${today}`),
        fetch(`/api/point/entries?user_id=${userId}&week=true`),
        fetch(`/api/point/overtime?user_id=${userId}`),
      ]);

      const [todayData, weekData, otData] = await Promise.all([
        todayRes.json(),
        weekRes.json(),
        otRes.json(),
      ]);

      setTodayEntry(todayData.entry || null);
      setOvertime(otData);

      // Build week grid
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);

      const weekMap: Record<string, TimeEntry> = {};
      for (const e of weekData.entries || []) {
        weekMap[e.date] = e;
      }

      const week: WeekDayEntry[] = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        const dow = d.getDay();
        const entry = weekMap[dateStr];
        week.push({
          date: dateStr,
          dayName: DAY_NAMES_FULL[dow],
          dayShort: DAY_NAMES[dow],
          totalHours: entry?.total_hours ? parseFloat(entry.total_hours as unknown as string) : null,
          isToday: dateStr === today,
          isFuture: d > now,
        });
      }

      setWeekEntries(week);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (action: ClockAction) => {
    if (!profile) return;
    setActionLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/point/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, user_id: profile.id, date: today }),
      });

      const data = await res.json();
      if (data.entry) {
        setTodayEntry(data.entry);
      }
      // Refresh week entries after action
      const weekRes = await fetch(`/api/point/entries?user_id=${profile.id}&week=true`);
      const weekData = await weekRes.json();

      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);

      const weekMap: Record<string, TimeEntry> = {};
      for (const e of weekData.entries || []) {
        weekMap[e.date] = e;
      }

      const week: WeekDayEntry[] = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        const dow = d.getDay();
        const entry = weekMap[dateStr];
        week.push({
          date: dateStr,
          dayName: DAY_NAMES_FULL[dow],
          dayShort: DAY_NAMES[dow],
          totalHours: entry?.total_hours ? parseFloat(entry.total_hours as unknown as string) : null,
          isToday: dateStr === today,
          isFuture: d > now,
        });
      }
      setWeekEntries(week);

      // Refresh overtime
      const otRes = await fetch(`/api/point/overtime?user_id=${profile.id}`);
      const otData = await otRes.json();
      setOvertime(otData);
    } catch (err) {
      // silent
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--color-cream)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: "4px solid var(--color-gold)",
              borderTop: "4px solid transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ color: "var(--color-brown-medium)" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(todayEntry);
  const isFinished = !!todayEntry?.clock_out;

  const currentHours = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();
  const currentSeconds = currentTime.getSeconds();
  const timeString = `${String(currentHours).padStart(2, "0")}:${String(currentMinutes).padStart(2, "0")}:${String(currentSeconds).padStart(2, "0")}`;

  // Overtime progress (target: user's schedule expected monthly hours, max display at 2x)
  const expectedMonthlyHours = overtime?.expected_monthly_hours || 40;
  const otTotal = overtime?.total_overtime_hours || 0;
  const progressPercent = expectedMonthlyHours > 0
    ? Math.min(100, (otTotal / expectedMonthlyHours) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Big Clock Card */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-gold)]/5 via-transparent to-transparent pointer-events-none" />
          <div className="relative text-center py-8">
            {/* Live Time */}
            <div className="flex items-center justify-center gap-2 mb-4 sm:mb-6">
              <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-[var(--color-gold)]" />
              <span
                className="text-4xl sm:text-5xl md:text-6xl font-bold text-[var(--color-brown-dark)] font-mono tracking-wider"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                {timeString}
              </span>
            </div>

            {/* Date */}
            <p className="text-sm text-[var(--color-brown-medium)] mb-4 uppercase tracking-widest">
              {currentTime.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>

            {/* Status Badge */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <span className={`text-lg font-semibold ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              {!isFinished && todayEntry && (
                <span className="w-2 h-2 rounded-full bg-[var(--color-gold)] animate-pulse" />
              )}
            </div>

            {/* Today's Timestamps */}
            {todayEntry && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8 max-w-md mx-auto">
                <div className="text-center">
                  <p className="text-xs text-[var(--color-brown-medium)] uppercase tracking-wide mb-1">
                    Entrada
                  </p>
                  <p className="text-sm font-mono font-semibold text-[var(--color-brown-dark)]">
                    {formatTime(todayEntry.clock_in)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-[var(--color-brown-medium)] uppercase tracking-wide mb-1">
                    Início Alm.
                  </p>
                  <p className="text-sm font-mono font-semibold text-[var(--color-brown-dark)]">
                    {formatTime(todayEntry.lunch_start)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-[var(--color-brown-medium)] uppercase tracking-wide mb-1">
                    Fim Alm.
                  </p>
                  <p className="text-sm font-mono font-semibold text-[var(--color-brown-dark)]">
                    {formatTime(todayEntry.lunch_end)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-[var(--color-brown-medium)] uppercase tracking-wide mb-1">
                    Saída
                  </p>
                  <p className="text-sm font-mono font-semibold text-[var(--color-brown-dark)]">
                    {formatTime(todayEntry.clock_out)}
                  </p>
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="max-w-xs mx-auto">
              {getActionButton(
                isFinished ? null : statusInfo.nextAction,
                handleAction,
                isFinished
              )}
            </div>
          </div>
        </Card>

        {/* Weekly Grid */}
        <Card>
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2
              className="text-lg font-semibold text-[var(--color-brown-dark)]"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Esta Semana
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
              {weekEntries.map((day) => (
                <div
                  key={day.date}
                  className={`relative flex flex-col items-center p-4 rounded-xl transition-all ${
                    day.isToday
                      ? "bg-[var(--color-gold)]/10 border-2 border-[var(--color-gold)]"
                      : day.isFuture
                      ? "opacity-40"
                      : "bg-white border border-[var(--border)]"
                  }`}
                >
                  <span className="text-sm font-medium text-[var(--color-brown-medium)] mb-2">
                    {day.dayShort}
                  </span>
                  <span className="text-2xl font-bold text-[var(--color-brown-dark)] mb-1">
                    {new Date(day.date + "T12:00:00").getDate()}
                  </span>
                  {day.totalHours !== null && !day.isFuture ? (
                    <span className="text-xs font-mono text-[var(--color-green-olive)] font-semibold">
                      {formatHoursDisplay(day.totalHours)}
                    </span>
                  ) : day.isFuture ? (
                    <span className="text-xs text-[var(--color-brown-light)]">—</span>
                  ) : (
                    <span className="text-xs text-[var(--color-brown-light)]">—</span>
                  )}
                  {day.isToday && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--color-gold)]" />
                  )}
                </div>
              ))}
            </div>

            {/* Weekly summary */}
            {!isFinished && (
              <p className="text-center text-sm text-[var(--color-brown-medium)] mt-4">
                Finalize o ponto de hoje para ver o total da semana
              </p>
            )}
          </div>
        </Card>

        {/* Overtime Summary */}
        <Card>
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2
              className="text-lg font-semibold text-[var(--color-brown-dark)]"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Horas Extras
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="text-center">
              <p className="text-sm text-[var(--color-brown-medium)] mb-1">
                Este mês
              </p>
              <p className="text-4xl font-bold text-[var(--color-gold)]">
                {overtime?.formatted?.total || "0m"}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-[var(--color-brown-medium)]">
                <span>0h</span>
                <span>{overtime?.formatted?.expected || "—"} esperado/mês</span>
                <span>{formatHoursDisplay(otTotal)}</span>
              </div>
              <div className="h-3 bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--color-gold)] to-[var(--color-green-olive)] rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-3 bg-[var(--color-cream)] rounded-lg">
                <p className="text-xs text-[var(--color-brown-medium)] uppercase tracking-wide mb-1">
                  Pendente
                </p>
                <p className="text-lg font-bold text-[var(--color-brown-dark)]">
                  {overtime?.formatted?.pending || "0m"}
                </p>
              </div>
              <div className="text-center p-3 bg-[var(--color-cream)] rounded-lg">
                <p className="text-xs text-[var(--color-brown-medium)] uppercase tracking-wide mb-1">
                  Aprovado
                </p>
                <p className="text-lg font-bold text-[var(--color-green-olive)]">
                  {overtime?.formatted?.approved || "0m"}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
