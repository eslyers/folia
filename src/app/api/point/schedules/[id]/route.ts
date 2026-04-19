import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, tenant_id")
      .eq("id", session.user.id)
      .single();

    if (!profile || profile.role !== "admin") {
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
    const supabase = await createClient();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, tenant_id")
      .eq("id", session.user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
