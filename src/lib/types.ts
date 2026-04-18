// FOLIA - Type Definitions
// Following PRD v1.0 specifications

// =====================================================
// ENUMS
// =====================================================

export type UserRole = "admin" | "employee";

export type LeaveType = "vacation" | "day_off" | "hours" | "sick" | "other";

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export type NotificationType = "info" | "success" | "warning" | "error";

// =====================================================
// INTERFACES
// =====================================================

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string | null;
  vacation_balance: number;
  hours_balance: number;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  emergency_contact?: string | null;
  hire_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  hours_count?: number;
  notes?: string | null;
  status: LeaveStatus;
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  reviewer?: Profile;
}

export interface Policy {
  id: string;
  name: string;
  vacation_days_per_year: number;
  carry_over_days: number;
  max_consecutive_days: number;
  min_days_notice: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  link?: string | null;
  created_at: string;
}

// =====================================================
// CALENDAR TYPES
// =====================================================

export interface CalendarEvent {
  id: string;
  date: Date;
  type: LeaveType;
  status: LeaveStatus;
  userId: string;
  userName?: string;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

// =====================================================
// NOTIFICATION TYPES
// =====================================================

export interface NotificationLog {
  id: string;
  user_id: string;
  type: string;
  status: "sent" | "failed";
  message: string;
  email_sent: boolean;
  error?: string | null;
  created_at: string;
}

export interface HourEntry {
  id: string;
  user_id: string;
  date: string;
  hours: number;
  type: "extra" | "compensated";
  notes?: string | null;
  created_at: string;
}

export interface NotificationEmail {
  to: string;
  subject: string;
  html: string;
}

// =====================================================
// UI CONSTANTS (from PRD Design System)
// =====================================================

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  vacation: "Férias",
  day_off: "Folga",
  hours: "Banco de Horas",
  sick: "Licença",
  other: "Outro",
};

export const STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
};

export const STATUS_BADGE_COLORS: Record<LeaveStatus, { bg: string; text: string }> = {
  pending: { bg: "bg-[#C4883A]/10", text: "text-[#C4883A]" },
  approved: { bg: "bg-[#4A7C4E]/10", text: "text-[#4A7C4E]" },
  rejected: { bg: "bg-[#A65D4E]/10", text: "text-[#A65D4E]" },
  cancelled: { bg: "bg-gray-100", text: "text-gray-500" },
};

// =====================================================
// DESIGN TOKENS (from PRD)
// =====================================================

export const DESIGN_TOKENS = {
  colors: {
    primary: {
      greenOlive: "#5C724A",
      gold: "#C7A76C",
      goldVivid: "#D4A853",
    },
    background: {
      cream: "#F5F0E6",
      white: "#FFFFFF",
    },
    text: {
      brownDark: "#2C2416",
      brownMedium: "#6B5F4D",
    },
    status: {
      success: "#4A7C4E",
      warning: "#C4883A",
      error: "#A65D4E",
    },
  },
  typography: {
    headings: {
      fontFamily: "var(--font-playfair)",
      weights: [500, 600, 700],
    },
    body: {
      fontFamily: "var(--font-inter)",
      weights: [400, 500, 600],
    },
    accent: {
      fontFamily: "var(--font-montserrat)",
      weights: [500, 600],
    },
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    "2xl": "48px",
    "3xl": "64px",
  },
  borderRadius: {
    sm: "4px",
    md: "8px",
    lg: "16px",
    xl: "24px",
    full: "9999px",
  },
  shadows: {
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 6px rgba(0,0,0,0.07)",
    lg: "0 10px 15px rgba(0,0,0,0.1)",
    xl: "0 20px 25px rgba(0,0,0,0.15)",
  },
  motion: {
    duration: {
      micro: "200ms",
      standard: "300ms",
      complex: "400ms",
    },
    easing: {
      enter: "ease-out",
      exit: "ease-in",
    },
  },
} as const;

// =====================================================
// UTILITY TYPES
// =====================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};