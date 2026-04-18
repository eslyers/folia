"use client";

import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  isWeekend,
  isToday,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui";
import type { LeaveRequest, Profile } from "@/lib/types";
import { LEAVE_TYPE_LABELS } from "@/lib/types";
import { BRAZILIAN_HOLIDAYS, isHoliday } from "@/lib/holidays";

interface CalendarProps {
  leaveRequests?: LeaveRequest[];
  profiles?: Profile[];
  onDateClick?: (date: Date) => void;
  showNavigation?: boolean;
  currentUserName?: string;
}

export function Calendar({
  leaveRequests = [],
  profiles = [],
  onDateClick,
  showNavigation = true,
  currentUserName,
}: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tooltip, setTooltip] = useState<{ show: boolean; x: number; y: number; content: string }>({
    show: false,
    x: 0,
    y: 0,
    content: "",
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getLeaveForDate = (date: Date) => {
    // Compare dates as YYYY-MM-DD strings to avoid timezone issues
    const dateStr = date.toLocaleDateString('en-CA'); // Returns YYYY-MM-DD in local time
    return leaveRequests.filter((req) => {
      return dateStr >= req.start_date && dateStr <= req.end_date;
    });
  };

  const getHolidayForDate = (date: Date) => {
    const dateStr = date.toLocaleDateString('en-CA');
    return isHoliday(dateStr);
  };

  const getUserName = (userId: string) => {
    const user = profiles.find((p) => p.id === userId);
    if (user?.name) return user.name;
    // If profiles list is empty but we have currentUserName, use that
    if (currentUserName && profiles.length === 0) return currentUserName;
    return "Você";
  };

  const getDayStyle = (date: Date) => {
    const leaves = getLeaveForDate(date);
    const isInCurrentMonth = isSameMonth(date, currentDate);
    const isWeekendDay = isWeekend(date);
    const isTodayDate = isToday(date);

    if (!isInCurrentMonth) {
      return "text-[var(--color-brown-medium)]/40";
    }

    const holiday = getHolidayForDate(date);
    if (holiday) {
      return "bg-red-100 text-red-700 font-medium";
    }

    if (isWeekendDay) {
      return "bg-[var(--color-cream)] text-[var(--color-brown-medium)]";
    }

    if (isTodayDate) {
      return "bg-[var(--color-gold)] text-[var(--color-brown-dark)] font-semibold ring-2 ring-[var(--color-gold)] ring-offset-2 ring-offset-[var(--color-surface)]";
    }

    const hasApproved = leaves.some((l) => l.status === "approved");
    const hasPending = leaves.some((l) => l.status === "pending");

    if (hasApproved) {
      return "bg-[var(--color-success)]/20 text-[var(--color-success)] font-medium";
    }

    if (hasPending) {
      return "bg-[var(--color-warning)]/20 text-[var(--color-warning)] font-medium";
    }

    return "text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]";
  };

  const getLeaveTypeColor = (type: string) => {
    switch (type) {
      case "vacation": return { backgroundColor: "#3b82f6" }; // blue-500
      case "day_off": return { backgroundColor: "#a855f7" }; // purple-500
      case "hours": return { backgroundColor: "#f97316" }; // orange-500
      case "sick": return { backgroundColor: "#ef4444" }; // red-500
      case "other": return { backgroundColor: "#6b7280" }; // gray-500
      default: return { backgroundColor: "#9ca3af" }; // gray-400
    }
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const handleMouseEnter = (e: React.MouseEvent, day: Date) => {
    const leaves = getLeaveForDate(day);
    if (leaves.length > 0) {
      const names = leaves.map((l) => {
        const name = getUserName(l.user_id);
        const status = l.status === "approved" ? "✅" : "⏳";
        const typeName = LEAVE_TYPE_LABELS[l.type as keyof typeof LEAVE_TYPE_LABELS] || l.type;
        return `${status} ${name} (${typeName})`;
      });
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setTooltip({
        show: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
        content: names.join("\n"),
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip({ show: false, x: 0, y: 0, content: "" });
  };

  return (
    <div className="w-full relative">
      {/* Tooltip */}
      {tooltip.show && (
        <div
          className="fixed z-50 bg-[var(--color-brown-dark)] text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-pre-line pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          {tooltip.content}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-[var(--color-brown-dark)]" />
        </div>
      )}

      {/* Header */}
      {showNavigation && (
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h3 className="text-lg font-semibold text-[var(--color-brown-dark)] capitalize">
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-[var(--color-brown-medium)] py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const leaves = getLeaveForDate(day);
          const isInCurrentMonth = isSameMonth(day, currentDate);

          return (
            <button
              key={idx}
              onClick={() => onDateClick?.(day)}
              onMouseEnter={(e) => {
                const leaves = getLeaveForDate(day);
                const holiday = getHolidayForDate(day);
                if (leaves.length > 0) {
                  handleMouseEnter(e, day);
                } else if (holiday) {
                  // Show holiday tooltip
                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                  setTooltip({
                    show: true,
                    x: rect.left + rect.width / 2,
                    y: rect.top - 10,
                    content: `🎉 ${holiday.name}${holiday.type === "optional" ? " (facultativo)" : ""}`,
                  });
                }
              }}
              onMouseLeave={handleMouseLeave}
              disabled={!isInCurrentMonth}
              className={clsx(
                "aspect-square p-1 rounded-lg text-sm flex flex-col items-center justify-center transition-folia relative",
                getDayStyle(day),
                onDateClick && isInCurrentMonth && "cursor-pointer"
              )}
            >
              <span className="leading-none">{format(day, "d")}</span>
              {leaves.length > 0 && isInCurrentMonth && (
                <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center max-w-full">
                  {leaves.slice(0, 6).map((l, i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={getLeaveTypeColor(l.type)}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 text-xs text-[var(--color-brown-medium)]">
          <span className="w-3 h-3 rounded bg-blue-500" />
          <span>Férias</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-brown-medium)]">
          <span className="w-3 h-3 rounded bg-purple-500" />
          <span>Folga</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-brown-medium)]">
          <span className="w-3 h-3 rounded bg-orange-500" />
          <span>Banco de Horas</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-brown-medium)]">
          <span className="w-3 h-3 rounded bg-red-500" />
          <span>Licença</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-brown-medium)]">
          <span className="w-3 h-3 rounded bg-gray-500" />
          <span>Outro</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-brown-medium)]">
          <span className="w-3 h-3 rounded bg-[var(--color-gold)]" />
          <span>Hoje</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-red-600">
          <span className="w-3 h-3 rounded bg-red-200" />
          <span>Feriado</span>
        </div>
      </div>
    </div>
  );
}
