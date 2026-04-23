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
  size?: "normal" | "compact";
}

export function Calendar({
  leaveRequests = [],
  profiles = [],
  onDateClick,
  showNavigation = true,
  currentUserName,
  size = "normal",
}: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tooltip, setTooltip] = useState<{ show: boolean; x: number; y: number; content: string }>({
    show: false,
    x: 0,
    y: 0,
    content: "",
  });

  const isCompact = size === "compact";
  const containerPadding = isCompact ? "p-2" : "p-4";
  const navMargin = isCompact ? "mb-1" : "mb-4";
  const titleSize = isCompact ? "text-xs" : "text-lg";
  const headerMargin = isCompact ? "mb-0.5" : "mb-2";
  const dayHeaderPadding = isCompact ? "py-0.5" : "py-2";
  const dayHeaderText = isCompact ? "text-[8px]" : "text-xs";
  const dayCellPadding = isCompact ? "p-0" : "p-1";
  const dayCellText = isCompact ? "text-[9px]" : "text-sm";
  const dayHeight = isCompact ? "h-6" : "h-9";
  const dotSize = isCompact ? "w-0.5 h-0.5" : "w-2 h-2";
  const dotsMargin = isCompact ? "mt-0" : "mt-0.5";
  const legendMargin = isCompact ? "mt-1 pt-1" : "mt-4 pt-4";
  const legendGap = isCompact ? "gap-1" : "gap-4";
  const legendItemGap = isCompact ? "gap-1" : "gap-2";
  const legendDotSize = isCompact ? "w-1.5 h-1.5" : "w-3 h-3";
  const legendText = isCompact ? "text-[9px]" : "text-xs";
  const navBtnSize = isCompact ? "h-5 w-5" : "h-5 w-5";

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getLeaveForDate = (date: Date) => {
    const dateStr = date.toLocaleDateString('en-CA');
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
      case "vacation": return { backgroundColor: "#3b82f6" };
      case "day_off": return { backgroundColor: "#a855f7" };
      case "hours": return { backgroundColor: "#f97316" };
      case "sick": return { backgroundColor: "#ef4444" };
      case "other": return { backgroundColor: "#6b7280" };
      default: return { backgroundColor: "#9ca3af" };
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
    <div className={containerPadding}>
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

      {showNavigation && (
        <div className={`flex items-center justify-between ${navMargin}`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h3 className={`${titleSize} font-semibold text-[var(--color-brown-dark)] capitalize`}>
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

      <div className={`grid grid-cols-7 gap-1 ${headerMargin}`}>
        {weekDays.map((day) => (
          <div
            key={day}
            className={`text-center text-xs font-medium text-[var(--color-brown-medium)] ${dayHeaderPadding}`}
          >
            {day}
          </div>
        ))}
      </div>

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
                `aspect-square rounded-lg flex flex-col items-center justify-center transition-folia relative ${dayCellPadding} ${dayCellText} ${dayHeight}`,
                getDayStyle(day),
                onDateClick && isInCurrentMonth && "cursor-pointer"
              )}
            >
              <span className="leading-none">{format(day, "d")}</span>
              {leaves.length > 0 && isInCurrentMonth && (
                <div className={`flex flex-wrap gap-0.5 ${dotsMargin} justify-center max-w-full`}>
                  {leaves.slice(0, 6).map((l, i) => (
                    <span
                      key={i}
                      className={`rounded-full flex-shrink-0 ${dotSize}`}
                      style={getLeaveTypeColor(l.type)}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className={`flex flex-wrap ${legendGap} ${legendMargin} border-t border-[var(--border)]`}>
        <div className={`flex items-center ${legendItemGap} ${legendText} text-[var(--color-brown-medium)]`}>
          <span className={`rounded ${legendDotSize} bg-blue-500`} />
          <span>Férias</span>
        </div>
        <div className={`flex items-center ${legendItemGap} ${legendText} text-[var(--color-brown-medium)]`}>
          <span className={`rounded ${legendDotSize} bg-purple-500`} />
          <span>Folga</span>
        </div>
        <div className={`flex items-center ${legendItemGap} ${legendText} text-[var(--color-brown-medium)]`}>
          <span className={`rounded ${legendDotSize} bg-orange-500`} />
          <span>Banco de Horas</span>
        </div>
        <div className={`flex items-center ${legendItemGap} ${legendText} text-[var(--color-brown-medium)]`}>
          <span className={`rounded ${legendDotSize} bg-red-500`} />
          <span>Licença</span>
        </div>
        <div className={`flex items-center ${legendItemGap} ${legendText} text-[var(--color-brown-medium)]`}>
          <span className={`rounded ${legendDotSize} bg-gray-500`} />
          <span>Outro</span>
        </div>
        <div className={`flex items-center ${legendItemGap} ${legendText} text-[var(--color-brown-medium)]`}>
          <span className={`rounded ${legendDotSize} bg-[var(--color-gold)]`} />
          <span>Hoje</span>
        </div>
        <div className={`flex items-center ${legendItemGap} ${legendText} text-red-600`}>
          <span className={`rounded ${legendDotSize} bg-red-200`} />
          <span>Feriado</span>
        </div>
      </div>
    </div>
  );
}
