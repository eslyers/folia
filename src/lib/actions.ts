"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { LeaveType } from "@/lib/types";

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
  if (type === "vacation") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("vacation_balance")
      .eq("id", user.id)
      .single();

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
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Apenas admins podem aprovar pedidos" };
  }

  // Get request details
  const { data: request } = await supabase
    .from("leave_requests")
    .select("*, profile:profiles(vacation_balance, hours_balance)")
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

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { success: true };
}

export async function rejectLeaveRequest(requestId: string, rejectionReason?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Check admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Apenas admins podem rejeitar pedidos" };
  }

  // Get request details for audit
  const { data: request } = await supabase
    .from("leave_requests")
    .select("*")
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

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { success: true };
}

export async function cancelLeaveRequest(requestId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Get current request for audit
  const { data: request } = await supabase
    .from("leave_requests")
    .select("*")
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
