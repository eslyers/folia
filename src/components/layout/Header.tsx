"use client";

import { useEffect, useState } from "react";
import { Bell, Palette } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface HeaderProps {
  profile: Profile;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

const THEMES = [
  {
    id: "default",
    name: "Padrão",
    colors: ["#2C2416", "#C7A76C", "#F5F0E8", "#F5F0E8"],
    surface: "#FFFFFF",
    border: "#D4CFC7",
    secondary: "#6B5F4D",
    description: "Tema original marrom/dourado"
  },
  {
    id: "dark",
    name: "Dark",
    colors: ["#F5F5F5", "#D4A853", "#121212", "#121212"],
    surface: "#1A1A1A",
    border: "#2D2D2D",
    secondary: "#A0A0A0",
    card: "#1E1E1E",
    description: "Modo escuro premium"
  },
  {
    id: "blue",
    name: "Azul",
    colors: ["#1E3A5F", "#3B82F6", "#EFF6FF", "#F8FAFC"],
    surface: "#FFFFFF",
    border: "#CBD5E1",
    secondary: "#475569",
    description: "Azul corporativo premium"
  },
  {
    id: "green",
    name: "Verde",
    colors: ["#14532D", "#22C55E", "#F0FDF4", "#F5FDF5"],
    surface: "#FFFFFF",
    border: "#BBF7D0",
    secondary: "#166534",
    description: "Verde orgânico premium"
  },
  {
    id: "purple",
    name: "Roxo",
    colors: ["#3B0764", "#9333EA", "#FAF5FF", "#FAFAFA"],
    surface: "#FFFFFF",
    border: "#E9D5FF",
    secondary: "#6B21A8",
    description: "Roxo royal elegante"
  },
];

export function Header({ profile }: HeaderProps) {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [currentTheme, setCurrentTheme] = useState("default");

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem("folia-theme") || "default";
    setCurrentTheme(savedTheme);
    applyTheme(savedTheme);

    // Fetch notifications
    fetchNotifications();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const applyTheme = (themeId: string) => {
    const theme = THEMES.find(t => t.id === themeId);
    if (!theme) return;

    const root = document.documentElement;
    root.style.setProperty("--color-brown-dark", theme.colors[0]);
    root.style.setProperty("--color-gold", theme.colors[1]);
    root.style.setProperty("--color-cream", theme.colors[2]);
    root.style.setProperty("--background", theme.colors[3]);
    if (theme.border) root.style.setProperty("--border", theme.border);
    if (theme.secondary) root.style.setProperty("--color-brown-medium", theme.secondary);
    if (theme.surface) root.style.setProperty("--color-surface", theme.surface);
    if ((theme as any).card) root.style.setProperty("--color-card", (theme as any).card);
    
    // Set data-theme attribute for CSS dark theme support
    if (themeId === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.setAttribute("data-theme", themeId === "default" ? "light" : themeId);
    }
  };

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data && Array.isArray(data)) {
      setNotifications(data);
      setUnreadCount(data.filter((n: Notification) => !n.read).length);
    }
  };

  const markAsRead = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    fetchNotifications();
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    for (const id of unreadIds) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
    }

    fetchNotifications();
  };

  const changeTheme = (themeId: string) => {
    setCurrentTheme(themeId);
    localStorage.setItem("folia-theme", themeId);
    applyTheme(themeId);
    setShowThemePicker(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "agora";
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    return `${diffDays}d atrás`;
  };

  return (
    <header className="bg-[var(--color-surface)] border-b border-[var(--border)] px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-gold)] flex items-center justify-center">
          <span className="text-white font-bold text-sm">F</span>
        </div>
        <span className="font-semibold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)] hidden sm:block">
          FOLIA
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Theme Picker */}
        <div className="relative">
          <button
            onClick={() => setShowThemePicker(!showThemePicker)}
            className="p-2 rounded-lg hover:bg-[var(--color-cream)] transition-colors"
            title="Trocar tema"
          >
            <Palette className="h-5 w-5 text-[var(--color-brown-medium)]" />
          </button>

          {showThemePicker && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowThemePicker(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--color-surface)] rounded-xl shadow-xl border border-[var(--border)] p-3 z-50">
                <p className="text-xs font-semibold text-[var(--color-brown-medium)] mb-2 px-2">
                  Escolha um tema
                </p>
                <div className="space-y-1">
                  {THEMES.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => changeTheme(theme.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        currentTheme === theme.id
                          ? "bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
                          : "hover:bg-[var(--color-cream)]"
                      }`}
                    >
                      <div className="flex gap-1">
                        {theme.colors.map((color, i) => (
                          <div
                            key={i}
                            className="w-4 h-4 rounded-full border border-white/20"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium">{theme.name}</span>
                      {currentTheme === theme.id && (
                        <span className="ml-auto text-xs">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg hover:bg-[var(--color-cream)] transition-colors relative"
          >
            <Bell className="h-5 w-5 text-[var(--color-brown-medium)]" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--color-surface)] rounded-xl shadow-xl border border-[var(--border)] z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                  <h3 className="font-semibold text-[var(--color-brown-dark)]">
                    Notificações
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-[var(--color-gold)] hover:underline"
                    >
                      Marcar todas como lidas
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[var(--color-brown-medium)]">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma notificação</p>
                    </div>
                  ) : (
                    notifications.map(notification => (
                      <div
                        key={notification.id}
                        onClick={() => !notification.read && markAsRead(notification.id)}
                        className={`px-4 py-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--color-cream)]/50 transition-colors cursor-pointer ${
                          !notification.read ? "bg-[var(--color-gold)]/5" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {!notification.read && (
                            <div className="w-2 h-2 rounded-full bg-[var(--color-gold)] mt-2 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-brown-dark)]">
                              {notification.title}
                            </p>
                            <p className="text-xs text-[var(--color-brown-medium)] mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-[var(--color-brown-medium)]/70 mt-1">
                              {formatTime(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Avatar */}
        <div className="ml-2 w-8 h-8 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center overflow-hidden">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.name || "User"}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-semibold text-[var(--color-gold)]">
              {(profile.name || profile.email || "U").charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}