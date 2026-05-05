"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Settings,
  LogOut,
  Menu,
  ChevronDown,
  Sun,
  Moon,
  Building2,
  Palette,
  Leaf,
  Waves,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import type { Profile } from "@/lib/types";
import { getRoleLabel } from "@/lib/auth";
import { clsx } from "clsx";

interface Tenant {
  id: string;
  name: string;
  domain?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface TopbarProps {
  profile: Profile;
  pendingCount?: number;
  onMenuToggle?: () => void;
}

export function Topbar({
  profile,
  pendingCount = 0,
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

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch notifications
  useEffect(() => {
    if (profile?.id) {
      fetchNotifications();
    }
  }, [profile?.id]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.notifications-dropdown')) {
        setNotificationsOpen(false);
      }
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

    if (notificationsOpen || tenantDropdownOpen || userDropdownOpen || themeDropdownOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [notificationsOpen, tenantDropdownOpen, userDropdownOpen, themeDropdownOpen]);

  // Apply theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as typeof theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const fetchNotifications = async () => {
    if (!profile?.id) return;
    
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
    }
  };

  const handleThemeChange = (newTheme: typeof theme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    setThemeDropdownOpen(false);
  };

  const handleTenantSelect = (tenant: Tenant) => {
    setTenantDropdownOpen(false);
    setCurrentTenant(tenant);
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
    fetchNotifications();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const userInitial = profile?.name?.charAt(0).toUpperCase() ?? "U";
  const roleLabel = getRoleLabel(profile?.role);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            {!isMobile && (
              <span className="font-semibold text-[var(--color-brown-dark)]">
                FOLIA
              </span>
            )}
          </Link>
        </div>

        <div className="w-px h-8 bg-gray-200 mx-2" />

        {/* Company Selector */}
        <div className="relative group tenant-dropdown">
          <button
            onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <Building2 className="h-5 w-5 text-[#5C724A]" />
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold text-stone-900 leading-tight max-w-[150px] truncate">
                {currentTenant?.name || profile?.tenant_id || "Selecione empresa"}
              </p>
              <p className="text-xs text-stone-500 leading-tight">{roleLabel}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400 hidden sm:block" />
          </button>

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
                    <span className="text-xs text-[#5C724A] font-medium">Atual</span>
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
          {/* Notifications */}
          <div className="relative notifications-dropdown">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNotificationsOpen(!notificationsOpen);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative"
            >
              <Bell className="h-5 w-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">Notificações</p>
                  {unreadCount > 0 && (
                    <span className="text-xs text-[#5C724A] font-medium">{unreadCount} não lidas</span>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500 text-sm">
                      Nenhuma notificação
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => markAsRead(notif.id)}
                        className={clsx(
                          "w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0",
                          !notif.is_read && "bg-blue-50/50"
                        )}
                      >
                        <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatTime(notif.created_at)}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Theme selector */}
          <div className="relative theme-dropdown">
            <button
              onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Tema"
            >
              {theme === "light" && <Sun className="h-5 w-5 text-gray-600" />}
              {theme === "dark" && <Moon className="h-5 w-5 text-gray-600" />}
              {theme === "golden" && <Sparkles className="h-5 w-5 text-gray-600" />}
              {theme === "forest" && <Leaf className="h-5 w-5 text-gray-600" />}
              {theme === "ocean" && <Waves className="h-5 w-5 text-gray-600" />}
            </button>

            {themeDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                {[
                  { key: "light", label: "Claro", icon: <Sun className="h-4 w-4" /> },
                  { key: "dark", label: "Escuro", icon: <Moon className="h-4 w-4" /> },
                  { key: "golden", label: "Dourado", icon: <Sparkles className="h-4 w-4" /> },
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
                      <Sparkles className="h-4 w-4 ml-auto text-[#5C724A]" />
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

            {userDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{profile?.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{profile?.email}</p>
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
