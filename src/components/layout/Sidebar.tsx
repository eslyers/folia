"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Building2,
  Users,
  CalendarCheck,
  Clock,
  BarChart3,
  ScrollText,
  Scroll,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  UserCog,
  UserCircle,
  Bell,
} from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { isMasterAdmin, isTenantAdmin, isGestor } from "@/lib/auth";

interface SidebarProps {
  profile: Profile;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
}

const MASTER_ADMIN_ITEMS: NavItem[] = [
  { label: "Visão Geral", href: "/admin", icon: Home, exact: true },
  { label: "Empresas SaaS", href: "/admin/saas", icon: Building2 },
  { label: "Controle Acesso", href: "/admin/saas/access-control", icon: Shield },
  { label: "Funcionários Global", href: "/admin/employees", icon: Users },
  { label: "Gestão Acessos", href: "/admin/access", icon: UserCog },
  { label: "Escalas", href: "/admin/schedules", icon: CalendarCheck },
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
  { label: "Visão Geral", href: "/admin", icon: Home, exact: true },
  { label: "Funcionários", href: "/admin/employees", icon: Users },
  { label: "Escalas", href: "/admin/schedules", icon: CalendarCheck },
  { label: "Ponto", href: "/admin/team/point", icon: Clock },
  { label: "Fechamento", href: "/admin/timesheets", icon: BarChart3 },
  { label: "Histórico", href: "/admin/audit", icon: ScrollText },
  { label: "Configurações", href: "/admin/settings", icon: Settings },
];

const GESTOR_ITEMS: NavItem[] = [
  { label: "Minha Equipe", href: "/admin/employees", icon: Users },
  { label: "Ponto", href: "/admin/team/point", icon: Clock },
  { label: "Meus Pedidos", href: "/admin/my-requests", icon: CalendarCheck },
  { label: "Configurações", href: "/admin/settings", icon: Settings },
];

const FUNCIONARIO_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home, exact: true },
  { label: "Ponto", href: "/dashboard/point", icon: Clock },
  { label: "Meus Pedidos", href: "/admin/my-requests", icon: CalendarCheck },
  { label: "Configurações", href: "/settings", icon: Settings },
];

function getNavItems(role: string): NavItem[] {
  if (role === "master_admin") return MASTER_ADMIN_ITEMS;
  if (role === "tenant_admin") return TENANT_ADMIN_ITEMS;
  if (role === "gestor") return GESTOR_ITEMS;
  return FUNCIONARIO_ITEMS;
}

const ROLE_BADGE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  master_admin: { bg: "bg-purple-100", text: "text-purple-800", label: "🏆 Master Admin" },
  tenant_admin: { bg: "bg-blue-100", text: "text-blue-800", label: "🏢 Admin" },
  gestor: { bg: "bg-green-100", text: "text-green-800", label: "👔 Gestor" },
  funcionario: { bg: "bg-gray-100", text: "text-gray-800", label: "👤 Funcionário" },
  admin: { bg: "bg-blue-100", text: "text-blue-800", label: "🏢 Admin" },
  employee: { bg: "bg-gray-100", text: "text-gray-800", label: "👤 Funcionário" },
};

function getRoleBadge(role: string) {
  const config = ROLE_BADGE_CONFIG[role] ?? ROLE_BADGE_CONFIG.funcionario;
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", config.bg, config.text)}>
      {config.label}
    </span>
  );
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const role = profile.role;
  const navItems = getNavItems(role);

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    const base = href.split("#")[0];
    return base !== "/" ? pathname.startsWith(base) : pathname === "/";
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isAdminSection = pathname.startsWith("/admin");

  const MobileOverlay = () => (
    <div 
      className="fixed inset-0 bg-black/50 z-40"
      onClick={() => setIsMobileOpen(false)}
    />
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo - Premium */}
      <div className="p-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center flex-shrink-0 rounded-xl bg-gradient-to-br from-[var(--color-gold)]/20 to-[var(--color-gold)]/5 p-1">
            {/* Static logo asset (does not change between themes) */}
            <img
              src="/folia-logo.jpg"
              alt="FOLIA"
              className="w-full h-full object-contain rounded-lg"
              draggable={false}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)] tracking-wide">
              FOLIA
            </span>
            <span className="text-xs text-[var(--color-brown-medium)] font-medium">
              {isAdminSection ? "Painel Administrativo" : "Meu Espaço"}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href + item.label}
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
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="p-4 border-t border-[var(--border)] space-y-3">
        <div className="px-3 py-2 rounded-lg bg-[var(--color-cream)]">
          <p className="text-xs text-[var(--color-brown-medium)] mb-1.5">Acesso</p>
          {getRoleBadge(role)}
        </div>

        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-[var(--color-gold)]">
              {profile.name?.charAt(0).toUpperCase() ?? "A"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-brown-dark)] truncate">
              {profile.name}
            </p>
            <p className="text-xs text-[var(--color-brown-medium)] truncate">{profile.email}</p>
          </div>
        </div>

        {profile.tenant_id && role !== "master_admin" && (
          <div className="px-3">
            <span className="text-xs text-[var(--color-brown-medium)] bg-[var(--color-cream)] px-2 py-1 rounded-md">
              🏢 {profile.tenant_id === "00000000-0000-0000-0000-000000000000" ? "Default" : profile.tenant_id.slice(0, 8)}
            </span>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--color-error)] hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );

  // Mobile hamburger - move to RIGHT side to avoid overlap with content
  const MobileHamburger = () => (
    <button
      onClick={() => setIsMobileOpen(true)}
      className="fixed top-4 right-4 z-50 p-2 bg-[var(--color-green-olive)] text-white rounded-lg shadow-lg lg:hidden"
    >
      <Menu className="h-6 w-6" />
    </button>
  );

  // Mobile close button inside sidebar
  const MobileCloseButton = () => (
    <div className="flex justify-end p-4 lg:hidden">
      <button 
        onClick={() => setIsMobileOpen(false)} 
        className="p-2 rounded-lg hover:bg-[var(--color-cream)]"
      >
        <X className="h-6 w-6" />
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger - right side to avoid overlap */}
      {isMobile && <MobileHamburger />}

      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className="w-64 min-h-screen bg-[var(--color-surface)] border-r border-[var(--border)] flex flex-col flex-shrink-0">
          <SidebarContent />
        </aside>
      )}

      {/* Mobile overlay */}
      {isMobile && isMobileOpen && <MobileOverlay />}

      {/* Mobile sidebar */}
      {isMobile && (
        <aside className={clsx(
          "fixed inset-y-0 right-0 z-50 w-72 bg-[var(--color-surface)] border-l border-[var(--border)] flex flex-col transform transition-transform duration-300 lg:hidden",
          isMobileOpen ? "translate-x-0" : "translate-x-full"
        )}>
          <MobileCloseButton />
          <SidebarContent />
        </aside>
      )}
    </>
  );
}