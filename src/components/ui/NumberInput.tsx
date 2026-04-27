"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { clsx } from "clsx";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  icon?: React.ReactNode;
}

export function NumberInput({
  value,
  onChange,
  label,
  min = 1,
  max = 9999,
  step = 1,
  icon,
}: NumberInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleIncrement = () => {
    const newValue = Math.min(value + step, max);
    onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(value - step, min);
    onChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || min;
    onChange(Math.max(min, Math.min(max, val)));
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
          {label}
        </label>
      )}
      <div className={clsx(
        "flex items-center gap-0 rounded-lg border bg-white transition-all",
        isFocused 
          ? "border-[#5C724A] ring-2 ring-[#5C724A]/20" 
          : "border-[var(--border)] hover:border-[#5C724A]/50"
      )}>
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          className="px-3 py-2.5 text-[#5C724A] hover:bg-[#5C724A]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-l-lg"
        >
          <Minus className="h-4 w-4" />
        </button>
        
        <div className="flex-1 flex items-center justify-center gap-2 border-x border-[var(--border)]">
          {icon && <span className="text-[#5C724A]">{icon}</span>}
          <input
            type="number"
            value={value}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            min={min}
            max={max}
            className="w-full text-center py-2.5 bg-transparent text-[var(--color-brown-dark)] font-medium focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
        
        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          className="px-3 py-2.5 text-[#5C724A] hover:bg-[#5C724A]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-r-lg"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      
      {/* Min/Max hint */}
      <p className="text-xs text-[var(--color-brown-medium)] mt-1 text-center">
        {min} - {max}
      </p>
    </div>
  );
}
