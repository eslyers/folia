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
  const supabase = createClient();
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light");
    document.documentElement.classList.toggle("dark");
  };

  const handleTenantSelect = (tenant: Tenant) => {
    setTenantDropdownOpen(false);
    if (onTenantChange) {
      onTenantChange(tenant);
    }
  };

  const userInitial = profile.name?.charAt(0).toUpperCase() ?? "U";
  const roleLabel = getRoleLabel(profile.role);

  return (
    <header className={clsx(
      "h-16 bg-stone-50/80 backdrop-blur-md border-b border-stone-200 flex items-center px-6 gap-4 sticky top-0 z-50 transition-shadow",
      scrolled && "shadow-sm"
    )}>
      {/* Hamburger + Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5 text-gray-600" />
        </button>

        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-[#5C724A] to-[#4A5F3C] rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="text-lg font-bold text-gray-900 tracking-tight">
            FOLIA
          </span>
        </Link>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <Link 
          href="/admin/notifications"
          className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-stone-100 transition-colors"
          title="Notificações"
        >
          <Bell className="h-5 w-5 text-stone-600" />
          {pendingCount > 0 && (
            <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          )}
        </Link>

        {/* Theme toggle */}
        <button 
          onClick={toggleTheme}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-stone-100 transition-colors"
          title={theme === "light" ? "Modo escuro" : "Modo claro"}
        >
          {theme === "light" ? (
            <Moon className="h-5 w-5 text-stone-600" />
          ) : (
            <Sun className="h-5 w-5 text-stone-600" />
          )}
        </button>

        {/* Settings */}
        <Link 
          href="/settings"
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-stone-100 transition-colors"
          title="Configurações"
        >
          <Settings className="h-5 w-5 text-stone-600" />
        </Link>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200 mx-2" />

        {/* Company Selector */}
        <div className="relative group">
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
          {tenants.length > 0 && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
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

        {/* User menu */}
        <div className="relative group">
          <button className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5C724A] to-[#4A5F3C] text-white flex items-center justify-center text-sm font-semibold shadow-sm">
              {userInitial}
            </div>
          </button>

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">{profile.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{profile.email}</p>
            </div>

            <div className="py-1">
              <Link 
                href="/settings" 
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
        </div>
      </div>
    </header>
  );
}
