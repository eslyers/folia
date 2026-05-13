"use client";

import { useState, useEffect, useRef } from "react";
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
  tenants?: Tenant[];
  currentTenant?: Tenant;
  pendingCount?: number;
  onMenuToggle?: () => void;
  onTenantChange?: (tenant: Tenant) => void;
}

export function Topbar({
  profile,
  tenants = [],
  currentTenant,
  pendingCount = 0,
  onMenuToggle,
  onTenantChange,
}: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
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

  
  // Fetch notifications on mount (remove polling - only fetch when needed)
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
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    if (!profile?.id) {
      
      return;
    }

    

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[Topbar] Error fetching notifications:", error);
    } else {
      
    }

    setNotifications(data || []);

    // Fetch unread count
    const { count, error: countError } = await supabase
      .from("notifications")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false);

    if (countError) {
      console.error("[Topbar] Error fetching unread count:", countError);
    }

    setUnreadCount(count || 0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const themes: { id: "light" | "dark" | "golden" | "forest" | "ocean"; label: string; icon: React.ReactNode }[] = [
    { id: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
    { id: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
    { id: "golden", label: "Golden", icon: <Sparkles className="h-4 w-4" /> },
    { id: "forest", label: "Forest", icon: <Leaf className="h-4 w-4" /> },
    { id: "ocean", label: "Ocean", icon: <Waves className="h-4 w-4" /> },
  ];

  const setThemeWithStorage = (newTheme: typeof theme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    setThemeDropdownOpen(false);
  };

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "golden" | "forest" | "ocean" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const handleTenantSelect = (tenant: Tenant) => {
    setTenantDropdownOpen(false);
    if (onTenantChange) {
      onTenantChange(tenant);
    }
  };

  const userInitial = profile.name?.charAt(0).toUpperCase() ?? "U";
  const roleLabel = getRoleLabel(profile.role);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Agora";
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <header className={clsx(
      "h-16 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] flex items-center px-6 gap-4 sticky top-0 z-50 transition-shadow",
      scrolled && "shadow-sm"
    )}>
      {/* Hamburger + Logo - Only on mobile */}
      <div className="flex items-center gap-3">
        {isMobile && (
          <button
            onClick={onMenuToggle}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[var(--color-cream)] transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </button>
        )}


      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <div className="relative notifications-dropdown">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[var(--color-cream)] transition-colors relative"
          >
            <Bell className="h-5 w-5 text-[var(--color-brown-medium)]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Popup */}
          {notificationsOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--card-bg)] rounded-2xl shadow-xl border border-[var(--border)] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <h3 className="font-semibold text-[var(--color-brown-dark)]">Notificações</h3>
                <Link
                  href="/admin/notifications"
                  onClick={() => setNotificationsOpen(false)}
                  className="text-xs text-[var(--color-gold-vivid)] hover:underline"
                >
                  Ver todas
                </Link>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[var(--color-brown-medium)] text-sm">
                    Nenhuma notificação
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={clsx(
                        "px-4 py-3 border-b border-[var(--border)] hover:bg-[var(--color-cream)] transition-colors",
                        !notif.is_read && "bg-[var(--color-gold)]/5"
                      )}
                    >
                      <p className="text-sm font-medium text-[var(--color-brown-dark)] truncate">{notif.title}</p>
                      <p className="text-xs text-[var(--color-brown-medium)] mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-xs text-[var(--color-brown-medium)]/70 mt-1">{formatTime(notif.created_at)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme selector dropdown */}
        <div className="relative theme-dropdown">
          <button
            onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[var(--color-cream)] transition-colors"
            title="Trocar tema"
          >
            <Palette className="h-5 w-5 text-[var(--color-brown-medium)]" />
          </button>

          {themeDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--card-bg)] rounded-xl shadow-xl border border-[var(--border)] overflow-hidden z-50">
              <div className="px-4 py-2.5 border-b border-[var(--border)]">
                <p className="text-xs font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide">Tema</p>
              </div>
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setThemeWithStorage(t.id)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors",
                    theme === t.id
                      ? "bg-[var(--color-gold)]/10 text-[var(--color-gold-vivid)] font-medium"
                      : "text-[var(--color-brown-medium)] hover:bg-[var(--color-cream)]"
                  )}
                >
                  <span className={clsx(
                    "w-7 h-7 rounded-lg flex items-center justify-center",
                    theme === t.id ? "bg-[var(--color-gold)]/20" : "bg-[var(--color-cream)]"
                  )}>
                    {t.icon}
                  </span>
                  {t.label}
                  {theme === t.id && (
                    <span className="ml-auto text-xs text-[var(--color-gold-vivid)]">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-[var(--border)] mx-2" />

        {/* Company Selector */}
        <div className="relative group tenant-dropdown">
          <button
            onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[var(--color-cream)] transition-colors"
          >
            <Building2 className="h-5 w-5 text-[var(--color-gold-vivid)]" />
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold text-[var(--color-brown-dark)] leading-tight max-w-[150px] truncate">
                {currentTenant?.name || (profile.tenant_id && (tenants.find(t => t.id === profile.tenant_id)?.name || profile.tenant_id)) || "Selecione empresa"}
              </p>
              <p className="text-xs text-[var(--color-brown-medium)] leading-tight">{roleLabel}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-[var(--color-brown-medium)] hidden sm:block" />
          </button>

          {/* Tenant Dropdown */}
          {tenantDropdownOpen && tenants.length > 0 && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--card-bg)] rounded-xl shadow-lg border border-[var(--border)] py-2 z-50">
              <div className="px-4 py-2 border-b border-[var(--border)]">
                <p className="text-xs font-medium text-[var(--color-brown-medium)] uppercase tracking-wide">Empresas</p>
              </div>
              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleTenantSelect(tenant)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-[var(--color-cream)] transition-colors",
                    tenant.id === currentTenant?.id && "bg-[var(--color-gold)]/5 text-[var(--color-gold-vivid)]"
                  )}
                >
                  <Building2 className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate text-[var(--color-brown-dark)]">{tenant.name}</span>
                  {tenant.id === currentTenant?.id && (
                    <span className="text-xs text-[var(--color-gold-vivid)] font-medium">Atual</span>
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
            className="w-10 h-10 rounded-xl bg-[var(--color-gold)]/20 text-[var(--color-gold-vivid)] flex items-center justify-center font-bold hover:bg-[var(--color-gold)]/30 transition-colors"
          >
            {userInitial}
          </button>

          {/* Dropdown */}
          {userDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--card-bg)] rounded-xl shadow-lg border border-[var(--border)] py-2 z-50">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-sm font-semibold text-[var(--color-brown-dark)] truncate">{profile.name}</p>
                <p className="text-xs text-[var(--color-brown-medium)] truncate mt-0.5">{profile.email}</p>
              </div>

              <div className="py-1">
                <Link
                  href="/settings"
                  onClick={() => setUserDropdownOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[var(--color-brown-medium)] hover:bg-[var(--color-cream)] transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  Configurações
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
