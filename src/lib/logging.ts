// Helper functions for logging and notifications
import { createClient } from "@/lib/supabase/client";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

/**
 * Log an action to system_logs table
 * Uses admin client to bypass RLS since logs should always work
 */
export async function logAction(
  action: string,
  module: string,
  details: string | object,
  userId?: string,
  tenantId?: string,
  ipAddress?: string
) {
  try {
    // Use admin client to bypass RLS - logs should always work regardless of auth state
    const supabase = createAdminClient();
    
    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
    
    const { error } = await supabase
      .from("system_logs")
      .insert({
        user_id: userId || null,
        tenant_id: tenantId || null,
        action,
        module,
        details: detailsStr,
        ip_address: ipAddress || null,
      } as any);
    
    if (error) {
      console.error("[logAction] Error:", error);
    }
  } catch (err) {
    console.error("[logAction] Exception:", err);
  }
}

/**
 * Create a notification for a user
 */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "success" | "error" | "info" | "warning" = "info",
  tenantId?: string
) {
  try {
    const supabase = createClient();
    
    const { error } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        tenant_id: tenantId || null,
        title,
        message,
        type,
        is_read: false,
      } as any);
    
    if (error) {
      console.error("[createNotification] Error:", error);
    }
  } catch (err) {
    console.error("[createNotification] Exception:", err);
  }
}

/**
 * Log AND notify in one call - convenience wrapper
 */
export async function logAndNotify(
  action: string,
  module: string,
  details: string | object,
  notifyUserId: string,
  notifyTitle: string,
  notifyMessage: string,
  userId?: string,
  tenantId?: string
) {
  // Log the action
  await logAction(action, module, details, userId, tenantId);
  
  // Create notification
  await createNotification(notifyUserId, notifyTitle, notifyMessage, "info", tenantId);
}