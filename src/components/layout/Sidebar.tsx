"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Calendar,
  Users,
  BarChart3,
  Settings,
  Clock,
  ClipboardCheck,
  Building2,
  Shield,
  UserCog,
  ScrollText,
  DollarSign,
  Bell,
  Scroll,
  UserCircle,
} from "lucide-react";
import { clsx } from "clsx";
import type { Profile } from "@/lib/types";
import { isMasterAdmin, isTenantAdmin, isGestor } from "@/lib/auth";

interface SidebarNavProps {
  profile: Profile;
  collapsed?: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
}

const MASTER_ADMIN_ITEMS: NavItem[] = [
  { label: "Visão Geral", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Empresas SaaS", href: "/admin/saas", icon: Building2 },
  { label: "Controle Acesso", href: "/admin/saas/access-control", icon: Shield },
  { label: "Funcionários Global", href: "/admin/employees", icon: Users },
  { label: "Gestão Acessos", href: "/admin/access", icon: UserCog },
  { label: "Escalas", href: "/admin/schedules", icon: Calendar },
  { label: "Ponto Equipe", href: "/admin/team/point", icon: Clock },
  { label: "Fechamento", href: "/admin/timesheets", icon: BarChart3 },
  { label: "Histórico/Audit", href: "/admin/audit", icon: ScrollText },
  { label: "Logs Sistema", href: "/admin/logs", icon: Scroll },
  { label: "Gestão Financeira", href: "/admin/finance", icon: DollarSign },
  { label: "Notificações", href: "/admin/notifications", icon: Bell },
  { label: "Configurações", href: "/admin/settings", icon: Settings },
  { label: "Meu Perfil", href: "/settings", icon: UserCircle },
];

const TENANT_ADMIN_ITEMS: NavItem[] = [
  { label: "Visão Geral", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Funcionários", href: "/admin/employees", icon: Users },
  { label: "Escalas", href: "/admin/schedules", icon: Calendar },
  { label: "Ponto", href: "/admin/team/point", icon: Clock },
  { label: "Fechamento", href: "/admin/timesheets", icon: BarChart3 },
  { label: "Histórico", href: "/admin/audit", icon: ScrollText },
  { label: "Notificações", href: "/admin/notifications", icon: Bell },
  { label: "Configurações", href: "/admin/settings", icon: Settings },
];

const GESTOR_ITEMS: NavItem[] = [
  { label: "Minha Equipe", href: "/admin/employees", icon: Users },
  { label: "Ponto", href: "/admin/team/point", icon: Clock },
  { label: "Meus Pedidos", href: "/admin/my-requests", icon: ClipboardCheck },
  { label: "Configurações", href: "/admin/settings", icon: Settings },
];

const FUNCIONARIO_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Ponto", href: "/dashboard/point", icon: Clock },
  { label: "Meus Pedidos", href: "/admin/my-requests", icon: ClipboardCheck },
  { label: "Configurações", href: "/settings", icon: Settings },
];

function getNavItems(role: string): NavItem[] {
  if (role === "master_admin") return MASTER_ADMIN_ITEMS;
  if (role === "tenant_admin") return TENANT_ADMIN_ITEMS;
  if (role === "gestor") return GESTOR_ITEMS;
  return FUNCIONARIO_ITEMS;
}

function getSectionLabel(pathname: string): string {
  if (pathname.startsWith("/admin")) return "Gestão";
  if (pathname.startsWith("/dashboard")) return "Menu";
  if (pathname.startsWith("/settings")) return "Sistema";
  return "Menu";
}

export function SidebarNav({ profile, collapsed = false }: SidebarNavProps) {
  const pathname = usePathname();
  const navItems = getNavItems(profile.role);
  const sectionLabel = getSectionLabel(pathname);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    const base = href.split("#")[0];
    return base !== "/" ? pathname.startsWith(base) : pathname === "/";
  };

  return (
    <nav className={clsx("flex flex-col h-full", collapsed ? "px-3 py-4" : "p-4")}>
      <div className="flex-1 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 pb-2">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
              {sectionLabel}
            </span>
          </div>
        )}
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-gradient-to-r from-[#5C724A] to-[#6B7D57] text-white shadow-sm"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={clsx("h-5 w-5 flex-shrink-0", active ? "text-white/90" : "text-stone-500")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

interface SidebarProps {
  profile: Profile;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  onMenuToggle?: () => void;
}

export function Sidebar({ profile, mobileOpen, onMobileClose, onMenuToggle }: SidebarProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (mobileOpen !== undefined) setIsMobileOpen(mobileOpen);
  }, [mobileOpen]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (pathname && onMobileClose) setIsMobileOpen(false);
  }, [pathname]);

  const handleMenuToggle = () => {
    if (onMenuToggle) onMenuToggle();
    else setIsMobileOpen(prev => !prev);
  };

  return (
    <>
      {/* Desktop sidebar - full height, unified */}
      {!isMobile && (
        <aside className="w-[280px] min-h-screen bg-[#F5F0E8] border-r border-stone-200 flex flex-col flex-shrink-0">
          {/* Logo area */}
          <div className="flex flex-col items-center justify-center p-6 border-b border-stone-200">
            <img src="/folia-logo.png" alt="FOLIA" className="w-36 h-36 object-contain" />
          </div>
          <SidebarNav profile={profile} />
        </aside>
      )}

      {/* Mobile overlay */}
      {isMobile && isMobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      {isMobile && (
        <aside className={clsx(
          "fixed inset-y-0 left-0 z-50 w-[280px] bg-stone-50 border-r border-stone-200 flex flex-col transition-transform duration-300",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex flex-col items-center justify-center p-6 border-b border-stone-200">
            <img src="/folia-logo.png" alt="FOLIA" className="w-32 h-32 object-contain" />
            <button onClick={() => setIsMobileOpen(false)} className="mt-2 p-2 rounded-lg hover:bg-stone-200 text-stone-600">
              ✕
            </button>
          </div>
          <SidebarNav profile={profile} />
        </aside>
      )}
    </>
  );
}