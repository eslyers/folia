"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  CalendarCheck,
  BarChart3,
  Settings,
  Home,
  ChevronRight,
  Clock,
  Building2,
  Webhook,
} from "lucide-react";
import { clsx } from "clsx";
import type { Profile } from "@/lib/types";

interface SidebarProps {
  profile: Profile;
}

const navItems = [
  {
    label: "Visão Geral",
    href: "/admin",
    icon: Home,
    exact: true,
  },
  {
    label: "Empresas (SaaS)",
    href: "/admin/saas",
    icon: Building2,
  },
  {
    label: "Funcionários",
    href: "/admin/employees",
    icon: Users,
  },
  {
    label: "Escalas",
    href: "/admin/schedules",
    icon: CalendarCheck,
  },
  {
    label: "Ponto",
    href: "/admin/team/point",
    icon: Clock,
  },
  {
    label: "Fechamento Mensal",
    href: "/admin/timesheets",
    icon: BarChart3,
  },
  {
    label: "Histórico",
    href: "/admin/audit",
    icon: BarChart3,
  },
  {
    label: "Webhooks",
    href: "/admin/saas#webhooks",
    icon: Webhook,
  },
  {
    label: "Configurações",
    href: "/admin/settings",
    icon: Settings,
  },
];

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href.split("#")[0]);
  };

  return (
    <aside className="w-64 min-h-screen bg-[var(--color-surface)] border-r border-[var(--border)] flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-green-olive)] flex items-center justify-center">
            <span className="text-white font-bold text-lg">F</span>
          </div>
          <span className="text-xl font-semibold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
            FOLIA
          </span>
        </div>
        <p className="text-xs text-[var(--color-brown-medium)] mt-2">
          Painel Administrativo
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-folia",
                active
                  ? "bg-[var(--color-green-olive)]/10 text-[var(--color-green-olive)]"
                  : "text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {active && (
                <ChevronRight className="h-4 w-4 opacity-50" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center">
            <span className="text-xs font-semibold text-[var(--color-gold)]">
              {profile.name?.charAt(0).toUpperCase() ?? "A"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-brown-dark)] truncate">
              {profile.name}
            </p>
            <p className="text-xs text-[var(--color-brown-medium)] truncate">
              {profile.role === "admin" ? "Administrador" : "Funcionário"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
