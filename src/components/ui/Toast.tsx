"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={clsx(
              "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-slide-in-right min-w-[300px] max-w-md",
              {
                "bg-[var(--color-success)] text-white": toast.type === "success",
                "bg-[var(--color-error)] text-white": toast.type === "error",
                "bg-[var(--color-brown-dark)] text-white": toast.type === "info",
                "bg-[var(--color-warning)] text-white": toast.type === "warning",
              }
            )}
          >
            {toast.type === "success" && <CheckCircle className="h-5 w-5 flex-shrink-0" />}
            {toast.type === "error" && <AlertCircle className="h-5 w-5 flex-shrink-0" />}
            {toast.type === "info" && <Info className="h-5 w-5 flex-shrink-0" />}
            {toast.type === "warning" && <AlertTriangle className="h-5 w-5 flex-shrink-0" />}
            <span className="flex-1 text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
