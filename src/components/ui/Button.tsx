"use client";

import { forwardRef, ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-folia focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
      primary: "bg-[var(--color-gold)] text-[var(--color-brown-dark)] hover:bg-[var(--color-gold-vivid)] hover:shadow-lg focus:ring-[var(--color-gold)]",
      secondary: "border-2 border-[var(--color-green-olive)] text-[var(--color-green-olive)] hover:bg-[var(--color-green-olive)] hover:text-white focus:ring-[var(--color-green-olive)]",
      ghost: "text-[var(--color-brown-medium)] hover:bg-[var(--color-cream)] hover:text-[var(--color-brown-dark)] focus:ring-[var(--color-brown-medium)]",
      danger: "bg-[var(--color-error)] text-white hover:bg-red-700 hover:shadow-lg focus:ring-[var(--color-error)]",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-base",
      lg: "px-6 py-3 text-lg",
    };

    return (
      <button
        ref={ref}
        className={clsx(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
