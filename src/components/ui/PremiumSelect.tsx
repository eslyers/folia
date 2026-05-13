"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { clsx } from "clsx";

interface Option {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface PremiumSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  icon?: React.ReactNode;
  hint?: string;
}

export function PremiumSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Selecione",
  icon,
  hint,
}: PremiumSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            "w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-card transition-all text-left",
            isOpen
              ? "border-[var(--color-green-olive)] ring-2 ring-[var(--color-green-olive)]/20"
              : "border-[var(--border)] hover:border-[var(--color-green-olive)]/50"
          )}
        >
          {icon && <span className="text-[var(--color-green-olive)]">{icon}</span>}
          <span className={clsx(
            "flex-1 text-sm",
            selectedOption ? "text-[var(--color-brown-dark)]" : "text-[var(--color-brown-medium)]"
          )}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className={clsx(
            "h-4 w-4 text-[var(--color-brown-medium)] transition-transform",
            isOpen && "rotate-180"
          )} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl shadow-lg border border-[var(--border)] py-2 z-50 max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-background transition-colors",
                  option.value === value && "bg-[var(--color-green-olive)]/5 text-[var(--color-green-olive)]"
                )}
              >
                {option.icon && <span className="text-[var(--color-green-olive)]">{option.icon}</span>}
                <span className="flex-1">{option.label}</span>
                {option.value === value && <Check className="h-4 w-4 text-[var(--color-green-olive)]" />}
              </button>
            ))}
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-[var(--color-brown-medium)] mt-1">{hint}</p>}
    </div>
  );
}
