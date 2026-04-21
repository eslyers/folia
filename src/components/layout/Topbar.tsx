"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Search, 
  Bell, 
  Settings, 
  LogOut, 
  Menu,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { getRoleLabel } from "@/lib/auth";
import { clsx } from "clsx";

interface TopbarProps {
  profile: Profile;
  pendingCount?: number;
  onMenuToggle?: () => void;
}

export function Topbar({ profile, pendingCount = 0, onMenuToggle }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [scrolled, setScrolled] = useState(false);

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

  const userInitial = profile.name?.charAt(0).toUpperCase() ?? "U";
  const userName = profile.name?.split(" ")[0] ?? "Usuário";
  const roleLabel = getRoleLabel(profile.role);

  return (
    <header className={clsx(
      "h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-6 sticky top-0 z-50 transition-shadow",
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
          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="text-lg font-bold text-gray-900 tracking-tight">
            FOLIA
          </span>
        </Link>
      </div>

      {/* Global Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar funcionários, pedidos..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:border-green-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        {pendingCount > 0 && (
          <button className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <Bell className="h-5 w-5 text-gray-600" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
          </button>
        )}

        {/* Settings */}
        <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
          <Settings className="h-5 w-5 text-gray-600" />
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* User menu */}
        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{userName}</p>
            <p className="text-xs text-gray-500 leading-tight">{roleLabel}</p>
          </div>

          <div className="relative group">
            <button className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">
                {userInitial}
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400 hidden sm:block" />
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
      </div>
    </header>
  );
}