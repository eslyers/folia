"use client";

import { useState, useRef, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
  getDay,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { clsx } from "clsx";

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
}

export function DatePicker({
  value,
  onChange,
  label,
  minDate,
  maxDate,
  placeholder = "Selecione uma data",
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? parseISO(value) : new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = value ? parseISO(value) : null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the day of week for the first day (0 = Sunday)
  const firstDayOfMonth = getDay(monthStart);

  // Pad the start with empty cells
  const paddedDays = Array(firstDayOfMonth).fill(null).concat(daysInMonth);

  const handleDateSelect = (date: Date) => {
    onChange(format(date, "yyyy-MM-dd"));
    setIsOpen(false);
  };

  const isDateDisabled = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    if (minDate && dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;
    return false;
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-2">
          {label}
        </label>
      )}

      {/* Input Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-white transition-all",
          "hover:border-[var(--color-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]",
          isOpen ? "border-[var(--color-gold)] ring-2 ring-[var(--color-gold)]" : "border-[var(--border)]"
        )}
      >
        <CalendarIcon className="h-5 w-5 text-[var(--color-gold)]" />
        <span className={clsx(
          "flex-1 text-left",
          selectedDate ? "text-[var(--color-brown-dark)]" : "text-[var(--color-brown-medium)]"
        )}>
          {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
        </span>
      </button>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-xl border-2 border-[var(--color-gold)] shadow-2xl p-4 min-w-[300px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-[var(--color-cream)] rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-[var(--color-brown-dark)]" />
            </button>
            <span className="font-semibold text-[var(--color-brown-dark)]">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-[var(--color-cream)] rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-[var(--color-brown-dark)]" />
            </button>
          </div>

          {/* Week Days Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-[var(--color-brown-medium)] py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {paddedDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="h-10" />;
              }

              const isSelected = selectedDate && format(date, "yyyy-MM-dd") === value;
              const isTodayDate = isToday(date);
              const isDisabled = isDateDisabled(date);

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleDateSelect(date)}
                  className={clsx(
                    "h-10 rounded-lg text-sm font-medium transition-all",
                    isSelected
                      ? "bg-[var(--color-gold)] text-[var(--color-brown-dark)]"
                      : isTodayDate
                      ? "bg-[var(--color-gold)]/20 text-[var(--color-gold)] border border-[var(--color-gold)]"
                      : isDisabled
                      ? "text-[var(--color-brown-medium)]/40 cursor-not-allowed"
                      : "hover:bg-[var(--color-cream)] text-[var(--color-brown-dark)]"
                  )}
                >
                  {format(date, "d")}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date())}
              className="flex-1 py-2 text-sm font-medium text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)] rounded-lg transition-colors"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex-1 py-2 text-sm font-medium text-[var(--color-brown-medium)] hover:bg-[var(--color-cream)] rounded-lg transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
