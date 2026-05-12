export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string
          tenant_id?: string | null
          user_id?: string | null
        }
      }
      hour_entries: {
        Row: {
          created_at: string | null
          date: string
          hours: number
          id: string
          notes: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          hours: number
          id?: string
          notes?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          hours?: number
          id?: string
          notes?: string | null
          type?: string
          user_id?: string
        }
      }
      leave_requests: {
        Row: {
          cancellation_reason: string | null
          created_at: string | null
          days_count: number
          end_date: string
          hours_count: number | null
          id: string
          notes: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          tenant_id: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          created_at?: string | null
          days_count: number
          end_date: string
          hours_count?: number | null
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          tenant_id?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancellation_reason?: string | null
          created_at?: string | null
          days_count?: number
          end_date?: string
          hours_count?: number | null
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          tenant_id?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
      }
      notification_logs: {
        Row: {
          created_at: string | null
          email_sent: boolean | null
          error: string | null
          id: string
          message: string
          status: string
          tenant_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_sent?: boolean | null
          error?: string | null
          id?: string
          message: string
          status: string
          tenant_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_sent?: boolean | null
          error?: string | null
          id?: string
          message?: string
          status?: string
          tenant_id?: string | null
          type?: string
          user_id?: string
        }
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
      }
      policies: {
        Row: {
          carry_over_days: number
          created_at: string | null
          id: string
          is_active: boolean | null
          max_consecutive_days: number
          min_days_notice: number
          name: string
          tenant_id: string | null
          updated_at: string | null
          vacation_days_per_year: number
        }
        Insert: {
          carry_over_days?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_consecutive_days?: number
          min_days_notice?: number
          name: string
          tenant_id?: string | null
          updated_at?: string | null
          vacation_days_per_year?: number
        }
        Update: {
          carry_over_days?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_consecutive_days?: number
          min_days_notice?: number
          name?: string
          tenant_id?: string | null
          updated_at?: string | null
          vacation_days_per_year?: number
        }
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          department: string | null
          email: string
          hire_date: string | null
          hours_balance: number
          id: string
          is_active: boolean | null
          manager_id: string | null
          name: string
          position: string | null
          role: string
          schedule_id: string | null
          tenant_id: string | null
          updated_at: string | null
          vacation_balance: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          email: string
          hire_date?: string | null
          hours_balance?: number
          id: string
          is_active?: boolean | null
          manager_id?: string | null
          name: string
          position?: string | null
          role?: string
          schedule_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          vacation_balance?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          email?: string
          hire_date?: string | null
          hours_balance?: number
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name?: string
          position?: string | null
          role?: string
          schedule_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          vacation_balance?: number
        }
      }
      system_logs: {
        Row: {
          action: string
          created_at: string | null
          details: string | null
          id: string
          ip_address: string | null
          module: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: string | null
          id?: string
          ip_address?: string | null
          module: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: string | null
          id?: string
          ip_address?: string | null
          module?: string
          tenant_id?: string | null
          user_id?: string | null
        }
      }
      tenants: {
        Row: {
          created_at: string | null
          domain: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
      }
      time_entries: {
        Row: {
          clock_in: string | null
          clock_out: string | null
          created_at: string | null
          date: string
          id: string
          lunch_end: string | null
          lunch_start: string | null
          notes: string | null
          overtime_hours: number | null
          status: string
          tenant_id: string
          total_hours: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          date: string
          id?: string
          lunch_end?: string | null
          lunch_start?: string | null
          notes?: string | null
          overtime_hours?: number | null
          status?: string
          tenant_id: string
          total_hours?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          date?: string
          id?: string
          lunch_end?: string | null
          lunch_start?: string | null
          notes?: string | null
          overtime_hours?: number | null
          status?: string
          tenant_id?: string
          total_hours?: number | null
          updated_at?: string | null
          user_id?: string
        }
      }
      work_schedules: {
        Row: {
          created_at: string | null
          daily_hours: number
          description: string | null
          end_work: string
          friday: boolean
          id: string
          is_active: boolean | null
          lunch_duration_minutes: number
          monday: boolean
          name: string
          saturday: boolean
          start_work: string
          sunday: boolean
          tenant_id: string | null
          thursday: boolean
          tolerance_minutes: number
          tuesday: boolean
          updated_at: string | null
          wednesday: boolean
        }
        Insert: {
          created_at?: string | null
          daily_hours?: number
          description?: string | null
          end_work?: string
          friday?: boolean
          id?: string
          is_active?: boolean | null
          lunch_duration_minutes?: number
          monday?: boolean
          name: string
          saturday?: boolean
          start_work?: string
          sunday?: boolean
          tenant_id?: string | null
          thursday?: boolean
          tolerance_minutes?: number
          tuesday?: boolean
          updated_at?: string | null
          wednesday?: boolean
        }
        Update: {
          created_at?: string | null
          daily_hours?: number
          description?: string | null
          end_work?: string
          friday?: boolean
          id?: string
          is_active?: boolean | null
          lunch_duration_minutes?: number
          monday?: boolean
          name?: string
          saturday?: boolean
          start_work?: string
          sunday?: boolean
          tenant_id?: string | null
          thursday?: boolean
          tolerance_minutes?: number
          tuesday?: boolean
          updated_at?: string | null
          wednesday?: boolean
        }
      }
    }
    Views: Record<never, never>
    Functions: {
      add_hours_balance: { Args: { p_minutes: number; p_user_id: string }; Returns: undefined }
      add_vacation_balance: { Args: { p_days: number; p_user_id: string }; Returns: undefined }
      deduct_hours_balance: { Args: { p_expected_balance: number; p_minutes: number; p_user_id: string }; Returns: undefined }
      deduct_vacation_balance: { Args: { p_days: number; p_expected_balance: number; p_user_id: string }; Returns: undefined }
      get_team_members: {
        Args: { p_manager_id: string }
        Returns: {
          department: string; email: string; hire_date: string
          hours_balance: number; id: string; name: string
          schedule_id: string; vacation_balance: number
        }[]
      }
      get_tenant_stats: { Args: { p_tenant_id: string }; Returns: Json }
      is_manager_of: { Args: { p_employee_id: string; p_manager_id: string }; Returns: boolean }
      is_tenant_admin: { Args: { p_user_id: string }; Returns: boolean }
      log_audit_action: {
        Args: { p_action: string; p_new_value?: Json; p_old_value?: Json; p_record_id: string; p_table_name: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

// =====================================================
// Convenience type aliases
// =====================================================
type DB = Database['public']

export type Profile = DB['Tables']['profiles']['Row']
export type ProfileInsert = DB['Tables']['profiles']['Insert']
export type ProfileUpdate = DB['Tables']['profiles']['Update']

export type Tenant = DB['Tables']['tenants']['Row']
export type TenantInsert = DB['Tables']['tenants']['Insert']
export type TenantUpdate = DB['Tables']['tenants']['Update']

export type LeaveRequest = DB['Tables']['leave_requests']['Row']
export type LeaveRequestInsert = DB['Tables']['leave_requests']['Insert']
export type LeaveRequestUpdate = DB['Tables']['leave_requests']['Update']

export type TimeEntry = DB['Tables']['time_entries']['Row']
export type WorkSchedule = DB['Tables']['work_schedules']['Row']
export type Notification = DB['Tables']['notifications']['Row']
export type NotificationLog = DB['Tables']['notification_logs']['Row']
export type HourEntry = DB['Tables']['hour_entries']['Row']
export type Policy = DB['Tables']['policies']['Row']
export type AuditLog = DB['Tables']['audit_log']['Row']
export type SystemLog = DB['Tables']['system_logs']['Row']

// =====================================================
// Domain types
// =====================================================
export type AppRole = 'master_admin' | 'tenant_admin' | 'gestor' | 'funcionario'

export type LeaveType = 'vacation' | 'day_off' | 'hours' | 'sick' | 'other'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export type LeaveRequestWithProfile = LeaveRequest & {
  profiles?: Pick<Profile, 'name' | 'email' | 'avatar_url' | 'department'>
}

export type TenantSettings = {
  timezone?: string
  locale?: string
  max_users?: number
  theme?: {
    primary?: string
    card?: string
  }
}
