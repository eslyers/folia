"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { LeaveType } from "@/lib/types";

// =====================================================
// WEBHOOK HELPERS
// =====================================================

async function sendWebhookNotification(
  tenantId: string,
  event: string,
  payload: Record<string, any>
) {
  try {
    // Get active webhooks for this tenant and event
    const supabase = await createClient();
    const { data: webhooks } = await supabase
      .from("webhook_configs")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (!webhooks || webhooks.length === 0) return;

    for (const webhook of webhooks) {
      if (!webhook.events.includes(event)) continue;

      // Format message based on channel
      let message: any;
      if (webhook.channel === "slack") {
        const msgs: Record<string, string> = {
          leave_request_created: `🎉 *Novo Pedido de Férias*\n👤 *${payload.user_name}*\n📅 De ${payload.start_date} até ${payload.end_date}\n📝 ${payload.days_count} dias`,
          leave_request_approved: `✅ *Pedido Aprovado*\n👤 *${payload.user_name}*\n📅 De ${payload.start_date} até ${payload.end_date}\n✅ Aprovado por ${payload.approver_name}`,
          leave_request_rejected: `❌ *Pedido Rejeitado*\n👤 *${payload.user_name}*\n📅 De ${payload.start_date} até ${payload.end_date}\n📝 Motivo: ${payload.rejection_reason || "Não informado"}`,
          leave_request_cancelled: `ℹ️ *Pedido Cancelado*\n👤 *${payload.user_name}*\n📅 De ${payload.start_date} até ${payload.end_date}`,
        };
        message = { text: msgs[event] || `📢 FOLIA: ${event}` };
      } else {
        const cards: Record<string, any> = {
          leave_request_created: {
            type: "message",
            attachments: [{
              contentType: "application/vnd.microsoft.card.adaptive",
              content: {
                type: "AdaptiveCard",
                body: [
                  { type: "TextBlock", size: "Large", weight: "Bolder", text: "🎉 Novo Pedido de Férias" },
                  { type: "FactSet", facts: [
                    { title: "Funcionário", value: payload.user_name },
                    { title: "Período", value: `${payload.start_date} até ${payload.end_date}` },
                    { title: "Dias", value: String(payload.days_count) },
                  ]},
                ],
              },
            }],
          },
          leave_request_approved: {
            type: "message",
            attachments: [{
              contentType: "application/vnd.microsoft.card.adaptive",
              content: {
                type: "AdaptiveCard",
                body: [
                  { type: "TextBlock", size: "Large", weight: "Bolder", text: "✅ Pedido Aprovado" },
                  { type: "FactSet", facts: [
                    { title: "Funcionário", value: payload.user_name },
                    { title: "Aprovado por", value: payload.approver_name },
                  ]},
                ],
              },
            }],
          },
          leave_request_rejected: {
            type: "message",
            attachments: [{
              contentType: "application/vnd.microsoft.card.adaptive",
              content: {
                type: "AdaptiveCard",
                body: [
                  { type: "TextBlock", size: "Large", weight: "Bolder", text: "❌ Pedido Rejeitado" },
                  { type: "FactSet", facts: [
                    { title: "Funcionário", value: payload.user_name },
                    { title: "Motivo", value: payload.rejection_reason || "Não informado" },
                  ]},
                ],
              },
            }],
          },
          leave_request_cancelled: {
            type: "message",
            attachments: [{
              contentType: "application/vnd.microsoft.card.adaptive",
              content: {
                type: "AdaptiveCard",
                body: [
                  { type: "TextBlock", size: "Large", weight: "Bolder", text: "ℹ️ Pedido Cancelado" },
                  { type: "FactSet", facts: [
                    { title: "Funcionário", value: payload.user_name },
                  ]},
                ],
              },
            }],
          },
        };
        message = cards[event] || { type: "message", text: `📢 FOLIA: ${event}` };
      }

      // Send webhook (fire and forget)
      fetch(webhook.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      }).catch(err => console.error("[Webhook] Failed to send:", err));
    }
  } catch (err) {
    console.error("[Webhook] Error:", err);
  }
}

// H4: Zod validation schemas
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
});

export const createLeaveRequestSchema = z.object({
  type: z.enum(["vacation", "sick", "personal", "other"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  notes: z.string().optional(),
}).refine((data) => new Date(data.start_date) <= new Date(data.end_date), {
  message: "Data de início deve ser anterior ou igual à data de fim",
  path: ["end_date"],
});

// Auth Actions
export async function login(formData: FormData): Promise<any> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // H4: Validate with Zod
  const result = loginSchema.safeParse({ email, password });
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    // Get profile to determine redirect
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    revalidatePath("/", "layout");

    // Redirect based on role
    if (profile?.role === "admin") {
      redirect("/admin");
    } else {
      redirect("/dashboard");
    }
  }

  return { error: "Unknown error" };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function register(formData: FormData): Promise<any> {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;

  // H4: Validate with Zod
  const result = registerSchema.safeParse({ email, password, name });
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    // NOTE: Profile is auto-created by the database trigger (handle_new_user)
    // DO NOT insert profile here as it causes unique constraint violations
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// Profile Actions
export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  const { error } = await supabase
    .from("profiles")
    .update({ name, email, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { success: true };
}

// Leave Request Actions
export async function createLeaveRequest(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const type = formData.get("type") as LeaveType;
  const start_date = formData.get("start_date") as string;
  const end_date = formData.get("end_date") as string;
  const notes = formData.get("notes") as string;

  // H4: Validate with Zod
  const result = createLeaveRequestSchema.safeParse({ type, start_date, end_date, notes });
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  // Calculate days
  const start = new Date(start_date);
  const end = new Date(end_date);
  const days_count = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Check for overlapping requests
  const { data: existing } = await supabase
    .from("leave_requests")
    .select("id")
    .eq("user_id", user.id)
    .neq("status", "cancelled")
    .or(`start_date.lte.${end_date},end_date.gte.${start_date}`);

  if (existing && existing.length > 0) {
    return { error: "Já existe um pedido de folga sobreposto para este período" };
  }

  // Check balance for vacation
  let userProfile: any = null;
  if (type === "vacation") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("vacation_balance, tenant_id, name")
      .eq("id", user.id)
      .single();

    userProfile = profile;
    if (profile && profile.vacation_balance < days_count) {
      return { error: `Saldo de férias insuficiente. Você tem ${profile.vacation_balance} dias.` };
    }
  }

  const { error } = await supabase.from("leave_requests").insert({
    user_id: user.id,
    type,
    start_date,
    end_date,
    days_count,
    notes: notes || null,
    status: "pending",
  });

  if (error) return { error: error.message };

  // Audit log: created leave_request
  await supabase.rpc("log_audit_action", {
    p_user_id: user.id,
    p_action: "created",
    p_table_name: "leave_requests",
    p_record_id: null,
    p_old_value: null,
    p_new_value: JSON.stringify({ type, start_date, end_date, days_count }),
  });

  // Send webhook notification for new leave request
  if (!userProfile) {
    const { data: up } = await supabase
      .from("profiles")
      .select("tenant_id, name")
      .eq("id", user.id)
      .single();
    userProfile = up;
  }
  if (userProfile?.tenant_id) {
    sendWebhookNotification(userProfile.tenant_id, "leave_request_created", {
      user_name: userProfile.name || "Funcionário",
      start_date,
      end_date,
      days_count,
      type,
    });
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function getLeaveRequests(userId?: string, includeAll?: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  // Check if admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  let query = supabase
    .from("leave_requests")
    .select("*, profile:profiles(name, email, role), reviewer:profiles(name)")
    .order("created_at", { ascending: false });

  if (includeAll && profile?.role === "admin") {
    // Admin sees all
  } else {
    query = query.eq("user_id", userId || user.id);
  }

  const { data, error } = await query;

  if (error) return [];
  return data || [];
}

export async function approveLeaveRequest(requestId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Check admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, tenant_id, name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Apenas admins podem aprovar pedidos" };
  }

  // Get request details
  const { data: request } = await supabase
    .from("leave_requests")
    .select("*, profile:profiles(vacation_balance, hours_balance, tenant_id, name)")
    .eq("id", requestId)
    .single();

  if (!request) return { error: "Pedido não encontrado" };

  // H1: Prevent admin from approving own request
  if (request.user_id === user.id) {
    return { error: "Você não pode aprovar seu próprio pedido" };
  }

  // Capture old values for audit
  const oldValues = { status: request.status, vacation_balance: request.profile?.vacation_balance };

  // C2: Atomic update - use single UPDATE with check to prevent race conditions
  if (request.type === "vacation" && request.profile) {
    // Atomic: UPDATE with check that balance hasn't changed since we read it
    const { error: balanceError } = await supabase.rpc("deduct_vacation_balance", {
      p_user_id: request.user_id,
      p_days: request.days_count,
      p_expected_balance: request.profile.vacation_balance,
    });

    if (balanceError) {
      return { error: "Falha ao atualizar saldo. Tente novamente." };
    }
  }

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) return { error: error.message };

  // Audit log: approve leave_request
  const newBalance = request.profile ? { vacation_balance: request.profile.vacation_balance - request.days_count } : null;
  await supabase.rpc("log_audit_action", {
    p_user_id: user.id,
    p_action: "approved",
    p_table_name: "leave_requests",
    p_record_id: requestId,
    p_old_value: JSON.stringify(oldValues),
    p_new_value: JSON.stringify({ status: "approved", ...newBalance }),
  });

  // Send webhook notification
  const requestTenantId = request.profile?.tenant_id || profile?.tenant_id;
  if (requestTenantId) {
    sendWebhookNotification(requestTenantId, "leave_request_approved", {
      user_name: request.profile?.name || "Funcionário",
      start_date: request.start_date,
      end_date: request.end_date,
      days_count: request.days_count,
      approver_name: profile?.name || "Admin",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { success: true };
}

export async function rejectLeaveRequest(requestId: string, rejectionReason?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Check admin
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role, tenant_id, name")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return { error: "Apenas admins podem rejeitar pedidos" };
  }

  // Get request details for audit
  const { data: request } = await supabase
    .from("leave_requests")
    .select("*, profile:profiles(tenant_id, name)")
    .eq("id", requestId)
    .single();

  if (!request) return { error: "Pedido não encontrado" };

  // H5: Capture and save rejection reason
  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: "rejected",
      rejection_reason: rejectionReason || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) return { error: error.message };

  // Audit log: reject leave_request
  await supabase.rpc("log_audit_action", {
    p_user_id: user.id,
    p_action: "rejected",
    p_table_name: "leave_requests",
    p_record_id: requestId,
    p_old_value: JSON.stringify({ status: request.status }),
    p_new_value: JSON.stringify({ status: "rejected", rejection_reason: rejectionReason }),
  });

  // Send webhook notification
  const requestTenantId = request.profile?.tenant_id || adminProfile?.tenant_id;
  if (requestTenantId) {
    sendWebhookNotification(requestTenantId, "leave_request_rejected", {
      user_name: request.profile?.name || "Funcionário",
      start_date: request.start_date,
      end_date: request.end_date,
      days_count: request.days_count,
      rejection_reason: rejectionReason,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { success: true };
}

export async function cancelLeaveRequest(requestId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Get current request for audit (include profile for tenant_id)
  const { data: request } = await supabase
    .from("leave_requests")
    .select("*, profile:profiles(tenant_id, name)")
    .eq("id", requestId)
    .single();

  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  // Audit log: cancelled leave_request
  if (request) {
    await supabase.rpc("log_audit_action", {
      p_user_id: user.id,
      p_action: "cancelled",
      p_table_name: "leave_requests",
      p_record_id: requestId,
      p_old_value: JSON.stringify({ status: request.status }),
      p_new_value: JSON.stringify({ status: "cancelled" }),
    });

    // Send webhook notification
    const requestTenantId = request.profile?.tenant_id;
    if (requestTenantId) {
      sendWebhookNotification(requestTenantId, "leave_request_cancelled", {
        user_name: request.profile?.name || "Funcionário",
        start_date: request.start_date,
        end_date: request.end_date,
        days_count: request.days_count,
      });
    }
  }

  revalidatePath("/dashboard");
  return { success: true };
}

// Admin: Get all profiles
export async function getAllProfiles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("name");

  if (error) return [];
  return data || [];
}
