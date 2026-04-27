// =====================================================
// SYSTEM LOG HELPER
// =====================================================

import { createClient } from "@/lib/supabase/server";

export type SystemLogAction = "login" | "logout" | "create" | "update" | "delete" | "approve" | "reject" | "assign" | "cancel";
export type SystemLogModule = "auth" | "employees" | "schedules" | "leave_requests" | "timesheets" | "tenants" | "access" | "system";

export interface LogActionParams {
  userId: string;
  tenantId?: string | null;
  action: SystemLogAction;
  module: SystemLogModule;
  details?: string;
  ipAddress?: string | null;
}

/**
 * Centralized helper to write to system_logs table
 * Use this for ALL significant user actions
 */
export async function logSystemAction(params: LogActionParams): Promise<{ success: boolean; logId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("system_logs")
      .insert({
        user_id: params.userId,
        tenant_id: params.tenantId || null,
        action: params.action,
        module: params.module,
        details: params.details || null,
        ip_address: params.ipAddress || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[logSystemAction] Error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, logId: data.id };
  } catch (err: any) {
    console.error("[logSystemAction] Catch error:", err);
    return { success: false, error: err.message };
  }
}

// =====================================================
// NOTIFICATION HELPER
// =====================================================

export type NotificationType = "info" | "success" | "warning" | "error";

export interface NotifyParams {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}

/**
 * Centralized helper to create notifications
 */
export async function createNotification(params: NotifyParams): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("notifications")
      .insert({
        user_id: params.userId,
        title: params.title,
        message: params.message,
        type: params.type || "info",
        link: params.link || null,
        is_read: false,
      });

    if (error) {
      console.error("[createNotification] Error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[createNotification] Catch error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Notify multiple users at once
 */
export async function createNotificationsForUsers(
  userIds: string[],
  title: string,
  message: string,
  type: NotificationType = "info",
  link?: string
): Promise<{ success: boolean; notified: number; error?: string }> {
  if (userIds.length === 0) return { success: true, notified: 0 };

  try {
    const supabase = await createClient();

    const notifications = userIds.map(userId => ({
      user_id: userId,
      title,
      message,
      type,
      link: link || null,
      is_read: false,
    }));

    const { error } = await supabase.from("notifications").insert(notifications);

    if (error) {
      console.error("[createNotificationsForUsers] Error:", error);
      return { success: false, notified: 0, error: error.message };
    }

    return { success: true, notified: userIds.length };
  } catch (err: any) {
    console.error("[createNotificationsForUsers] Catch error:", err);
    return { success: false, notified: 0, error: err.message };
  }
}
