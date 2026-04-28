import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction, createNotification } from "@/lib/logging";

// GET - List schedules
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", session.user.id)
      .single();

    // If tenant_admin, filter by tenant. master_admin sees all
    let query = supabase
      .from("work_schedules")
      .select("*")
      .order("name");
    
    if (profile?.tenant_id) {
      query = query.eq("tenant_id", profile.tenant_id);
    }

    const { data: schedules, error } = await query;

    if (error) {
      console.error("[Schedules GET] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ schedules: schedules || [] });

  } catch (error) {
    console.error("[Schedules GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // EXTRACT TOKEN FROM HEADER - THIS IS THE KEY FIX!
    const authHeader = request.headers.get("Authorization");
    let userId: string | null = null;
    let profile: any = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      console.log("[Schedules POST] Token received:", token.substring(0, 20) + "...");

      // Create a new supabase client and manually set the session with the token
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        console.log("[Schedules POST] Token validation failed:", authError?.message);
        return NextResponse.json({ error: "Unauthorized - invalid token" }, { status: 401 });
      }

      userId = user.id;
      console.log("[Schedules POST] User from token:", userId);

      // Get profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role, tenant_id")
        .eq("id", userId)
        .single();

      profile = profileData;

      if (!profile) {
        console.log("[Schedules POST] No profile found for user:", userId);
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }

      console.log("[Schedules POST] Profile:", profile);
    } else {
      // No token - try regular session
      console.log("[Schedules POST] No Authorization header found");
      const supabase = await createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        console.log("[Schedules POST] No session found");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      userId = session.user.id;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role, tenant_id")
        .eq("id", userId)
        .single();

      profile = profileData;

      if (!profile) {
        console.log("[Schedules POST] No profile found");
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }
    }

    // Role check - allow tenant_admin OR master_admin
    if (profile.role !== 'tenant_admin' && profile.role !== 'master_admin') {
      console.log("[Schedules POST] Role check failed:", profile.role);
      return NextResponse.json({ error: "Forbidden - role: " + profile.role }, { status: 403 });
    }

    // Parse body
    const body = await request.json();
    const {
      name,
      tenant_id, // Allow tenant_id from request body for master_admin
      daily_hours = 8,
      monday = true,
      tuesday = true,
      wednesday = true,
      thursday = true,
      friday = true,
      saturday = false,
      sunday = false,
      tolerance_minutes = 0,
      start_work = "09:00",
      end_work = "18:00",
      lunch_duration_minutes = 60,
      is_active = true,
    } = body;

    // Insert
    const supabase = await createClient();
    
    // For master_admin, use tenant_id from request body if provided
    // For tenant_admin, use their own tenant_id
    const finalTenantId = tenant_id || profile.tenant_id;
    
    if (!finalTenantId) {
      return NextResponse.json({ error: "tenant_id é obrigatório" }, { status: 400 });
    }
    
    const { data: schedule, error: insertError } = await supabase
      .from("work_schedules")
      .insert({
        name,
        daily_hours,
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday,
        sunday,
        tolerance_minutes,
        start_work,
        end_work,
        lunch_duration_minutes,
        is_active,
        tenant_id: finalTenantId,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Schedules POST] Insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.log("[Schedules POST] Created:", schedule);
    
    // Log the action
    await logAction(
      "create",
      "schedules",
      { schedule_id: schedule.id, schedule_name: name, tenant_id: finalTenantId },
      userId,
      finalTenantId
    );
    
    // Notify relevant users (tenant admins)
    const { data: tenantAdmins } = await supabase
      .from("profiles")
      .select("id")
      .eq("tenant_id", finalTenantId)
      .in("role", ["tenant_admin", "master_admin"]);
    
    if (tenantAdmins) {
      for (const admin of tenantAdmins) {
        await createNotification(
          admin.id,
          "Nova Escala Criada",
          `Escala "${name}" foi criada e está disponível para atribuição.`,
          "info",
          finalTenantId
        );
      }
    }
    
    return NextResponse.json({ schedule });

  } catch (error) {
    console.error("[Schedules POST] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
