import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // EXTRACT TOKEN FROM HEADER - Same as schedules API
    const authHeader = request.headers.get("Authorization");
    let userId: string | null = null;
    let profile: any = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized - invalid token" }, { status: 401 });
      }

      userId = user.id;

      // Get profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role, tenant_id")
        .eq("id", userId)
        .single();

      profile = profileData;

      if (!profile) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }
    } else {
      // No token - try regular session
      const supabase = await createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      userId = session.user.id;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role, tenant_id")
        .eq("id", userId)
        .single();

      profile = profileData;
    }

    if (!profile || !['admin', 'tenant_admin', 'master_admin'].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
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
    } = body;

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (daily_hours !== undefined) updates.daily_hours = daily_hours;
    if (monday !== undefined) updates.monday = monday;
    if (tuesday !== undefined) updates.tuesday = tuesday;
    if (wednesday !== undefined) updates.wednesday = wednesday;
    if (thursday !== undefined) updates.thursday = thursday;
    if (friday !== undefined) updates.friday = friday;
    if (saturday !== undefined) updates.saturday = saturday;
    if (sunday !== undefined) updates.sunday = sunday;
    if (tolerance_minutes !== undefined) updates.tolerance_minutes = tolerance_minutes;
    if (start_work !== undefined) updates.start_work = start_work;
    if (end_work !== undefined) updates.end_work = end_work;
    if (lunch_duration_minutes !== undefined) updates.lunch_duration_minutes = lunch_duration_minutes;
    if (is_active !== undefined) updates.is_active = is_active;

    const supabase = await createClient();
    const { data: schedule, error } = await supabase
      .from("work_schedules")
      .update(updates)
      .eq("id", id)
      .eq("tenant_id", profile.tenant_id)
      .select()
      .single();

    if (error) {
      console.error("[Schedules PUT] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ schedule });

  } catch (error) {
    console.error("[Schedules PUT] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // EXTRACT TOKEN FROM HEADER
    const authHeader = request.headers.get("Authorization");
    let userId: string | null = null;
    let profile: any = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized - invalid token" }, { status: 401 });
      }

      userId = user.id;

      // Get profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role, tenant_id")
        .eq("id", userId)
        .single();

      profile = profileData;

      if (!profile) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }
    } else {
      // No token - try regular session
      const supabase = await createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      userId = session.user.id;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role, tenant_id")
        .eq("id", userId)
        .single();

      profile = profileData;
    }

    if (!profile || !['admin', 'tenant_admin', 'master_admin'].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("work_schedules")
      .delete()
      .eq("id", id)
      .eq("tenant_id", profile.tenant_id);

    if (error) {
      console.error("[Schedules DELETE] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[Schedules DELETE] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
