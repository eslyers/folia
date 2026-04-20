"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, LogOut, Menu, X, Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { isTenantAdmin, isMasterAdmin, isGestor, getRoleLabel } from "@/lib/auth";

interface HeaderProps {
  profile: Profile;
  pendingCount?: number;
}

export function Header({ profile, pendingCount = 0 }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="bg-gradient-to-r from-white via-white/95 to-white border-b border-[var(--border)] sticky top-0 z-50 shadow-lg shadow-[var(--shadow-sm)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Premium Logo */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center">
              {/* Static logo asset (does not change between themes) */}
              <img
                src="/folia-logo.jpg"
                alt="FOLIA"
                className="w-12 h-12 object-contain"
                draggable={false}
              />
            </div>
            <div>
              <span className="text-2xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)] bg-gradient-to-r from-[var(--color-brown-dark)] to-[var(--color-brown-medium)] bg-clip-text text-transparent">
                FOLIA
              </span>
              <span className="text-xs text-[var(--color-brown-medium)] hidden sm:inline">Sistema de Controle de Férias</span>
            </div>
          </div>

          {/* Premium Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-1">
              {isTenantAdmin(profile.role) && (
                <>
                  <Link
                    href="/admin/employees"
                    className="px-4 py-2 text-sm font-medium text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/50 rounded-lg transition-all duration-200 group"
                  >
                    <span className="relative inline-flex items-center">
                      <span className="absolute -inset-0.5 bg-[var(--color-green-olive)]/20 rounded-lg group-hover:bg-[var(--color-green-olive)]/30 blur-sm" />
                      <span className="relative inline-flex items-center">
                        <User className="h-4 w-4 mr-2 text-[var(--color-brown-medium)] group-hover:text-[var(--color-brown-dark)]" />
                        Funcionários
                      </span>
                    </span>
                  </Link>
                  <Link
                    href="/admin/timesheets"
                    className="px-4 py-2 text-sm font-medium text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/50 rounded-lg transition-all duration-200 group"
                  >
                    <span className="relative inline-flex items-center">
                      <span className="absolute -inset-0.5 bg-[var(--color-gold)]/20 rounded-lg group-hover:bg-[var(--color-gold)]/30 blur-sm" />
                      <span className="relative inline-flex items-center">
                        <span className="h-4 w-4 mr-2 text-[var(--color-brown-medium)] group-hover:text-[var(--color-brown-dark)]">📊</span>
                        Fechamento
                      </span>
                    </span>
                  </Link>
                  <Link
                    href="/admin/team/point"
                    className="px-4 py-2 text-sm font-medium text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/50 rounded-lg transition-all duration-200 group"
                  >
                    <span className="relative inline-flex items-center">
                      <span className="absolute -inset-0.5 bg-[var(--color-green-olive)]/20 rounded-lg group-hover:bg-[var(--color-green-olive)]/30 blur-sm" />
                      <span className="relative inline-flex items-center">
                        <span className="h-4 w-4 mr-2 text-[var(--color-brown-medium)] group-hover:text-[var(--color-brown-dark)]">⏰</span>
                        Ponto
                      </span>
                    </span>
                  </Link>
                  <Link
                    href="/admin/schedules"
                    className="px-4 py-2 text-sm font-medium text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/50 rounded-lg transition-all duration-200 group"
                  >
                    <span className="relative inline-flex items-center">
                      <span className="absolute -inset-0.5 bg-[var(--color-purple)]/20 rounded-lg group-hover:bg-[var(--color-purple)]/30 blur-sm" />
                      <span className="relative inline-flex items-center">
                        <span className="h-4 w-4 mr-2 text-[var(--color-brown-medium)] group-hover:text-[var(--color-brown-dark)]">🗓️</span>
                        Escalas
                      </span>
                    </span>
                  </Link>
                </>
              )}
              <Link
                href={isTenantAdmin(profile.role) ? "/admin/my-requests" : "/dashboard"}
                className="px-4 py-2 text-sm font-medium text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/50 rounded-lg transition-all duration-200 group"
              >
                <span className="relative inline-flex items-center">
                  <span className="absolute -inset-0.5 bg-[var(--color-blue)]/20 rounded-lg group-hover:bg-[var(--color-blue)]/30 blur-sm" />
                  <span className="relative inline-flex items-center">
                    <span className="h-4 w-4 mr-2 text-[var(--color-brown-medium)] group-hover:text-[var(--color-brown-dark)]">📋</span>
                    Meus Pedidos
                  </span>
                </span>
              </Link>
              <Link
                href="/dashboard/point"
                className="px-4 py-2 text-sm font-medium text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/50 rounded-lg transition-all duration-200 group"
              >
                <span className="relative inline-flex items-center">
                  <span className="absolute -inset-0.5 bg-[var(--color-green-olive)]/20 rounded-lg group-hover:bg-[var(--color-green-olive)]/30 blur-sm" />
                  <span className="relative inline-flex items-center">
                    <span className="h-4 w-4 mr-2 text-[var(--color-brown-medium)] group-hover:text-[var(--color-brown-dark)]">⏰</span>
                    Ponto
                  </span>
                </span>
              </Link>
              <Link
                href="/team"
                className="px-4 py-2 text-sm font-medium text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/50 rounded-lg transition-all duration-200 group"
              >
                <span className="relative inline-flex items-center">
                  <span className="absolute -inset-0.5 bg-[var(--color-purple)]/20 rounded-lg group-hover:bg-[var(--color-purple)]/30 blur-sm" />
                  <span className="relative inline-flex items-center">
                    <span className="h-4 w-4 mr-2 text-[var(--color-brown-medium)] group-hover:text-[var(--color-brown-dark)]">👥</span>
                    Equipe
                  </span>
                </span>
              </Link>
            </div>
          </nav>

          {/* Premium Right Side */}
          <div className="flex items-center gap-3">
            {/* Premium Notification */}
            {isTenantAdmin(profile.role) && pendingCount > 0 && (
              <div className="relative">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-error)]/20 to-[var(--color-error)]/10 rounded-full blur-sm animate-pulse" />
                  <Bell className="relative z-10 h-5 w-5 text-[var(--color-error)]" />
                </div>
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-[var(--color-error)] to-[var(--color-error-dark)] text-white text-xs rounded-full flex items-center justify-center font-bold shadow-lg">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              </div>
            )}

            {/* Premium User Info */}
            <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-gradient-to-r from-[var(--color-cream)]/60 to-[var(--color-cream)]/40 rounded-full border border-[var(--border)] shadow-sm">
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.name} 
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-[var(--border)]" 
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-gold)] to-[var(--color-gold)]/50 flex items-center justify-center ring-1 ring-[var(--border)]">
                  <User className="h-4 w-4 text-[var(--color-gold-dark)]" />
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-[var(--color-brown-dark)]">{profile.name}</span>
                <span className="text-xs font-medium text-[var(--color-gold)] bg-[var(--color-gold)]/20 px-2 py-0.5 rounded-full mt-1 inline-block">
                      {getRoleLabel(profile.role)}
                    </span>
              </div>
            </div>

            {/* Premium Settings */}
            <Link href="/settings">
              <div className="p-2 rounded-lg hover:bg-[var(--color-cream)]/50 transition-all duration-200 group">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-gold)]/10 to-[var(--color-gold)]/5 rounded-lg blur-sm group-hover:bg-[var(--color-gold)]/20" />
                  <Settings className="relative z-10 h-4 w-4 text-[var(--color-brown-medium)] group-hover:text-[var(--color-brown-dark)]" />
                </div>
              </div>
            </Link>

            {/* Premium Logout */}
            <div className="p-2 rounded-lg hover:bg-[var(--color-rose)]/10 transition-all duration-200 group cursor-pointer" onClick={handleLogout}>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-rose)]/10 to-[var(--color-rose)]/5 rounded-lg blur-sm group-hover:bg-[var(--color-rose)]/20" />
                <LogOut className="relative z-10 h-4 w-4 text-[var(--color-brown-medium)] group-hover:text-[var(--color-rose)]" />
              </div>
            </div>

            {/* Premium Mobile Menu Button */}
            <button
              className="md:hidden p-2.5 rounded-lg hover:bg-[var(--color-cream)]/50 transition-all duration-200 group"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-blue)]/10 to-[var(--color-blue)]/5 rounded-lg blur-sm group-hover:bg-[var(--color-blue)]/20" />
                {menuOpen ? (
                  <X className="relative z-10 h-6 w-6 text-[var(--color-brown-dark)]" />
                ) : (
                  <Menu className="relative z-10 h-6 w-6 text-[var(--color-brown-medium)] group-hover:text-[var(--color-brown-dark)]" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Premium Mobile Menu */}
        {menuOpen && (
          <nav className="md:hidden py-4 border-t border-[var(--border)] animate-slide-up">
            <div className="flex flex-col gap-1">
              <div className="px-4 py-3 bg-gradient-to-r from-[var(--color-cream)]/60 to-[var(--color-cream)]/40 rounded-lg border border-[var(--border)] mb-2">
                <div className="flex items-center gap-3">
                  {profile.avatar_url ? (
                    <img 
                      src={profile.avatar_url} 
                      alt={profile.name} 
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-[var(--border)]" 
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-gold)] to-[var(--color-gold)]/50 flex items-center justify-center ring-1 ring-[var(--border)]">
                      <User className="h-5 w-5 text-[var(--color-gold-dark)]" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-[var(--color-brown-dark)]">{profile.name}</div>
                    <div className="text-xs text-[var(--color-brown-medium)]">{profile.email}</div>
                    <div className="text-xs font-medium text-[var(--color-gold)] bg-[var(--color-gold)]/20 px-2 py-0.5 rounded-full mt-1 inline-block">
                      {getRoleLabel(profile.role)}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-1">
                <Link
                  href={isTenantAdmin(profile.role) ? "/admin/my-requests" : "/dashboard"}
                  className="px-4 py-3 text-sm font-medium text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/50 rounded-lg transition-all duration-200 group relative overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-[var(--color-blue)]/10 to-[var(--color-blue)]/5 group-hover:[from-[var(--color-blue)]/20] group-hover:[to-[var(--color-blue)]/10] transition-all duration-200" />
                  <span className="relative inline-flex items-center gap-2">
                    <span className="w-4 h-4">📋</span>
                    Meus Pedidos
                  </span>
                </Link>
                
                <Link
                  href="/team"
                  className="px-4 py-3 text-sm font-medium text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/50 rounded-lg transition-all duration-200 group relative overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-[var(--color-purple)]/10 to-[var(--color-purple)]/5 group-hover:[from-[var(--color-purple)]/20] group-hover:[to-[var(--color-purple)]/10] transition-all duration-200" />
                  <span className="relative inline-flex items-center gap-2">
                    <span className="w-4 h-4">👥</span>
                    Calendário da Equipe
                  </span>
                </Link>

                <Link
                  href="/dashboard/point"
                  className="px-4 py-3 text-sm font-medium text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/50 rounded-lg transition-all duration-200 group relative overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-[var(--color-green-olive)]/10 to-[var(--color-green-olive)]/5 group-hover:[from-[var(--color-green-olive)]/20] group-hover:[to-[var(--color-green-olive)]/10] transition-all duration-200" />
                  <span className="relative inline-flex items-center gap-2">
                    <span className="w-4 h-4">⏰</span>
                    Meu Ponto
                  </span>
                </Link>

                {isTenantAdmin(profile.role) && (
                  <>
                    <Link
                      href="/admin/employees"
                      className="px-4 py-3 text-sm font-medium text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/50 rounded-lg transition-all duration-200 group relative overflow-hidden"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-[var(--color-green)]/10 to-[var(--color-green)]/5 group-hover:[from-[var(--color-green)]/20] group-hover:[to-[var(--color-green)]/10] transition-all duration-200" />
                      <span className="relative inline-flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Funcionários
                      </span>
                    </Link>

                    <Link
                      href="/admin/timesheets"
                      className="px-4 py-3 text-sm font-medium text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/50 rounded-lg transition-all duration-200 group relative overflow-hidden"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-[var(--color-gold)]/10 to-[var(--color-gold)]/5 group-hover:[from-[var(--color-gold)]/20] group-hover:[to-[var(--color-gold)]/10] transition-all duration-200" />
                      <span className="relative inline-flex items-center gap-2">
                        <span className="w-4 h-4">📊</span>
                        Fechamento Mensal
                      </span>
                    </Link>

                    <Link
                      href="/admin/team/point"
                      className="px-4 py-3 text-sm font-medium text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/50 rounded-lg transition-all duration-200 group relative overflow-hidden"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-[var(--color-green-olive)]/10 to-[var(--color-green-olive)]/5 group-hover:[from-[var(--color-green-olive)]/20] group-hover:[to-[var(--color-green-olive)]/10] transition-all duration-200" />
                      <span className="relative inline-flex items-center gap-2">
                        <span className="w-4 h-4">⏰</span>
                        Ponto Equipe
                      </span>
                    </Link>

                    <Link
                      href="/admin/schedules"
                      className="px-4 py-3 text-sm font-medium text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/50 rounded-lg transition-all duration-200 group relative overflow-hidden"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-[var(--color-purple)]/10 to-[var(--color-purple)]/5 group-hover:[from-[var(--color-purple)]/20] group-hover:[to-[var(--color-purple)]/10] transition-all duration-200" />
                      <span className="relative inline-flex items-center gap-2">
                        <span className="w-4 h-4">🗓️</span>
                        Escalas
                      </span>
                    </Link>

                    <Link
                      href="/admin"
                      className="px-4 py-3 text-sm font-medium text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/50 rounded-lg transition-all duration-200 group relative overflow-hidden"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-[var(--color-blue)]/10 to-[var(--color-blue)]/5 group-hover:[from-[var(--color-blue)]/20] group-hover:[to-[var(--color-blue)]/10] transition-all duration-200" />
                      <span className="relative inline-flex items-center gap-2">
                        <span className="w-4 h-4">📊</span>
                        Dashboard Admin
                      </span>
                    </Link>
                  </>
                )}
              </div>
              
              <div className="px-4 py-3 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
                <Link href="/settings" className="text-sm font-medium text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)] py-2 px-3 rounded-lg hover:bg-[var(--color-cream)]/50 transition-all duration-200">
                  <span className="inline-flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Configurações
                  </span>
                </Link>
                <button 
                  onClick={handleLogout}
                  className="text-sm font-medium text-[var(--color-rose)] hover:text-[var(--color-rose-dark)] py-2 px-3 rounded-lg hover:bg-[var(--color-rose)]/10 transition-all duration-200"
                >
                  <span className="inline-flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Sair
                  </span>
                </button>
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}