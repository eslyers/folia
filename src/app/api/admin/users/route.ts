import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { email, password, name, role, department, position, hire_date, vacation_balance, hours_balance, manager_id, schedule_id, tenant_id } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, senha e nome são obrigatórios" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Senha deve ter pelo menos 6 caracteres" },
        { status: 400 }
      );
    }

    // Use service role key for admin operations
    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get current user session for notification
    const { data: sessionData } = await supabaseAdmin.auth.getSession();
    const currentUserId = sessionData?.session?.user?.id;
    console.log("[Admin API POST] Current user ID:", currentUserId);

    // First create the user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: name,
        role: role || "employee",
      },
    });

    if (authError) {
      console.error("[Admin API] Auth error:", authError);
      return NextResponse.json(
        { error: "Erro ao criar usuário: " + authError.message },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Falha ao criar usuário" },
        { status: 500 }
      );
    }

    // Create profile
    const supabase = await createClient();

    // Use tenant_id from request body (sent from frontend), or leave null
    // The frontend already sends the admin's tenant_id in the body
    const profileTenantId = tenant_id || null;

    // Check if profile already exists (from failed previous attempt)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", authData.user.id)
      .single();

    if (existingProfile) {
      // Profile exists, update it
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          name: name,
          email: email,
          role: role || "employee",
          department: department || null,
          position: position || null,
          hire_date: hire_date || null,
          vacation_balance: vacation_balance || 30,
          hours_balance: hours_balance || 0,
          manager_id: manager_id || null,
          schedule_id: schedule_id || null,
          tenant_id: profileTenantId,
        })
        .eq("id", authData.user.id);

      if (updateError) {
        console.error("[Admin API] Profile update error:", updateError);
        return NextResponse.json(
          { error: "Erro ao atualizar perfil: " + updateError.message },
          { status: 500 }
        );
      }
    } else {
      // Create profile
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        name: name,
        email: email,
        role: role || "employee",
        department: department || null,
        position: position || null,
        hire_date: hire_date || null,
        vacation_balance: vacation_balance || 30,
        hours_balance: hours_balance || 0,
        manager_id: manager_id || null,
        schedule_id: schedule_id || null,
        tenant_id: profileTenantId,
      });

      if (profileError) {
        console.error("[Admin API] Profile error:", profileError);
        // Try to delete the auth user if profile creation fails
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        } catch (deleteError) {
          console.error("[Admin API] Failed to delete auth user:", deleteError);
        }
        return NextResponse.json(
          { error: "Erro ao criar perfil: " + profileError.message },
          { status: 500 }
        );
      }
    }

    // Create notification for admin who created the employee
    if (currentUserId) {
      const roleLabel = role === "gestor" ? "Gestor" : role === "tenant_admin" ? "Admin Empresa" : "Funcionário";
      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: currentUserId,
        title: "Funcionário criado",
        message: `${name} foi adicionado como ${roleLabel}${department ? ` no departamento ${department}` : ""}`,
        type: "success",
        is_read: false,
      });
      if (notifError) {
        console.error("[Admin API] Error creating notification:", notifError);
      } else {
        console.log("[Admin API] Notification created for user:", currentUserId);
      }
    } else {
      console.log("[Admin API] No session found for notification");
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: email,
        name: name,
      },
    });

  } catch (error) {
    console.error("[Admin API] Error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// Update user
export async function PUT(request: Request) {
  try {
    const { id, name, role, department, position, hire_date, vacation_balance, hours_balance, manager_id, schedule_id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID do usuário é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        name: name,
        role: role,
        department: department || null,
        position: position || null,
        hire_date: hire_date || null,
        vacation_balance: vacation_balance,
        hours_balance: hours_balance,
        manager_id: manager_id || null,
        schedule_id: schedule_id || null,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: "Erro ao atualizar: " + error.message },
        { status: 500 }
      );
    }

    // Create notification for admin who updated the employee
    const { data: updateSessionData } = await supabaseAdmin.auth.getSession();
    const updateUserId = updateSessionData?.session?.user?.id;
    if (updateUserId) {
      const roleLabel = role === "gestor" ? "Gestor" : role === "tenant_admin" ? "Admin Empresa" : "Funcionário";
      await supabase.from("notifications").insert({
        user_id: updateUserId,
        title: "Funcionário atualizado",
        message: `${name} teve seus dados atualizados (${roleLabel})`,
        type: "info",
        is_read: false,
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[Admin API] Error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}