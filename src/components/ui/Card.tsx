"use client";

import { HTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable = false, padding = "md", children, ...props }, ref) => {
    const paddingSizes = {
      none: "",
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    };

    return (
      <div
        ref={ref}
        className={clsx(
          "bg-[var(--surface)] rounded-2xl shadow-md border border-[var(--border)] transition-folia",
          hoverable && "hover:shadow-lg hover:-translate-y-0.5 cursor-pointer",
          paddingSizes[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export { Card };
