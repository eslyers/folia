"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Bell,
  ChevronDown,
  Clock,
  FileText,
  Home,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  Calendar,
  User,
  Check,
  SunMoon,
} from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { getRoleLabel } from "@/lib/auth";
import type { Profile } from "@/lib/types";

interface TopbarProps {
  profile: Profile;
  onMenuToggle?: () => void;
}

export function Topbar({
  profile,
  onMenuToggle,
}: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { currentTenant, setCurrentTenant, tenants } = useTenant();

  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "golden" | "forest" | "ocean">("light");
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.tenant-dropdown')) {
        setTenantDropdownOpen(false);
      }
      if (!target.closest('.user-dropdown')) {
        setUserDropdownOpen(false);
      }
      if (!target.closest('.theme-dropdown')) {
        setThemeDropdownOpen(false);
      }
    };

    if (tenantDropdownOpen || userDropdownOpen || themeDropdownOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [tenantDropdownOpen, userDropdownOpen, themeDropdownOpen]);

  // Apply theme
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as typeof theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const handleThemeChange = (newTheme: typeof theme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    setThemeDropdownOpen(false);
  };

  const handleTenantSelect = (tenant: Tenant) => {
    setTenantDropdownOpen(false);
    // Update context - this will trigger all listeners
    setCurrentTenant(tenant);
  };

  const userInitial = profile.name?.charAt(0).toUpperCase() ?? "U";
  const roleLabel = getRoleLabel(profile.role);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActiveTheme = (t: typeof theme) => theme === t;

  return (
    <header
      className={clsx(
        "bg-white border-b border-gray-200 z-40 transition-shadow",
        scrolled && "shadow-sm"
      )}
    >
      <div className="flex items-center justify-between px-4 h-16">
        {/* Left section */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </button>

          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5C724A] to-[#4A5F3C] flex items-center justify-center">
              <FileText className="h-4 w-4 text-white" />
            </div>
            {!isMobile && (
              <span className="font-semibold text-[var(--color-brown-dark)]">
                FOLIA
              </span>
            )}
          </Link>
        </div>

        <div className="w-px h-8 bg-gray-200 mx-2" />

        {/* Company Selector - reads from TenantContext */}
        <div className="relative group tenant-dropdown">
          <button
            onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <Building2 className="h-5 w-5 text-[#5C724A]" />
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold text-stone-900 leading-tight max-w-[150px] truncate">
                {currentTenant?.name || profile.tenant_id || "Selecione empresa"}
              </p>
              <p className="text-xs text-stone-500 leading-tight">{roleLabel}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400 hidden sm:block" />
          </button>

          {/* Tenant Dropdown */}
          {tenantDropdownOpen && tenants.length > 0 && (
            <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Empresas</p>
              </div>
              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleTenantSelect(tenant)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors",
                    tenant.id === currentTenant?.id && "bg-[#5C724A]/5 text-[#5C724A]"
                  )}
                >
                  <Building2 className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{tenant.name}</span>
                  {tenant.id === currentTenant?.id && (
                    <Check className="h-4 w-4 text-[#5C724A]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Theme selector */}
          <div className="relative theme-dropdown">
            <button
              onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Tema"
            >
              {theme === "light" && <Sun className="h-5 w-5 text-gray-600" />}
              {theme === "dark" && <Moon className="h-5 w-5 text-gray-600" />}
              {theme === "golden" && <SunMoon className="h-5 w-5 text-gray-600" />}
              {theme === "forest" && <span className="text-lg">🌲</span>}
              {theme === "ocean" && <span className="text-lg">🌊</span>}
            </button>

            {themeDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                {[
                  { key: "light", label: "Claro", icon: <Sun className="h-4 w-4" /> },
                  { key: "dark", label: "Escuro", icon: <Moon className="h-4 w-4" /> },
                  { key: "golden", label: "Dourado", icon: <SunMoon className="h-4 w-4" /> },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => handleThemeChange(t.key as typeof theme)}
                    className={clsx(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors",
                      isActiveTheme(t.key as typeof theme) && "bg-[#5C724A]/5 text-[#5C724A]"
                    )}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                    {isActiveTheme(t.key as typeof theme) && (
                      <Check className="h-4 w-4 ml-auto text-[#5C724A]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative user-dropdown">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5C724A] to-[#4A5F3C] text-white flex items-center justify-center text-sm font-semibold shadow-sm">
                {userInitial}
              </div>
            </button>

            {/* Dropdown */}
            {userDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{profile.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{profile.email}</p>
                </div>

                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    Configurações
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
