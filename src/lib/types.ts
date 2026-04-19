// FOLIA - Type Definitions
// Following PRD v1.0 specifications

// =====================================================
// ENUMS
// =====================================================

// =====================================================
// ENUMS
// =====================================================

// New RBAC roles: master_admin > tenant_admin > gestor > funcionario
export type UserRole = "master_admin" | "tenant_admin" | "gestor" | "funcionario";
export type LegacyRole = "admin" | "employee";
export type AnyRole = UserRole | LegacyRole;

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
  tenant_id?: string;
  manager_id?: string | null;
  schedule_id?: string | null;
  is_active?: boolean;
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
  tenant_id?: string;
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
  tenant_id?: string;
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
// TENANT TYPES (Multi-tenant SaaS)
// =====================================================

export interface Tenant {
  id: string;
  name: string;
  domain: string | null;
  slug: string;
  settings: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantStats {
  employee_count: number;
  pending_requests: number;
  approved_requests: number;
  total_requests: number;
}

export interface WebhookConfig {
  id: string;
  tenant_id: string;
  name: string;
  channel: "slack" | "teams";
  webhook_url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =====================================================
// TIME TRACKING TYPES
// =====================================================

export interface TimeEntry {
  id: string;
  tenant_id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  total_hours: number;
  overtime_hours: number;
  status: "open" | "closed" | "approved";
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkSchedule {
  id: string;
  tenant_id: string;
  name: string;
  daily_hours: number;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  tolerance_minutes: number;
  start_work: string;
  end_work: string;
  lunch_duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonthlyTimesheet {
  id: string;
  tenant_id: string;
  user_id: string;
  month: string;
  total_worked_hours: number;
  total_overtime_hours: number;
  approved_overtime_hours: number;
  overtime_pending_approval: number;
  status: "open" | "pending_approval" | "approved" | "rejected";
  approved_by?: string | null;
  approved_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OvertimeSummary {
  total_overtime_hours: number;
  pending_hours: number;
  approved_hours: number;
  total_worked_hours: number;
  expected_monthly_hours: number;
  working_days_in_month: number;
  daily_hours: number;
  formatted: {
    total: string;
    pending: string;
    approved: string;
    expected: string;
  };
}

export interface TeamTimesheetMember {
  user_id: string;
  user_name: string;
  department: string | null;
  schedule_name: string;
  daily_hours: number;
  total_worked_hours: number;
  total_overtime_hours: number;
  approved_overtime_hours: number;
  overtime_pending_approval: number;
  expected_monthly_hours: number;
  status: "open" | "approved" | "rejected";
}

export const ROLE_LABELS: Record<UserRole, string> = {
  master_admin: "Master Admin",
  tenant_admin: "Admin Empresa",
  gestor: "Gestor",
  funcionario: "Funcionário",
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] || role;
}

// Helper type guards
export function isMasterAdmin(role: string): boolean {
  return role === "master_admin";
}

export function isTenantAdmin(role: string): boolean {
  return role === "master_admin" || role === "tenant_admin";
}

export function isGestor(role: string): boolean {
  return role === "gestor";
}

export function isFuncionario(role: string): boolean {
  return role === "funcionario";
}

export function canManageTeam(role: string): boolean {
  return isTenantAdmin(role) || role === "gestor";
}

export function canAccessSaaS(role: string): boolean {
  return role === "master_admin";
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