import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTenantAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", session.user.id)
      .single();

    const tenantId = profile?.tenant_id || "00000000-0000-0000-0000-000000000000";

    const { data: schedules, error } = await supabase
      .from("work_schedules")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name");

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

    if (!profile || !isTenantAdmin(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      daily_hours = 8,
      monday = true,
      tuesday = true,
      wednesday = true,
      thursday = true,
      friday = true,
      saturday = false,
      sunday = false,
      tolerance_minutes = 5,
      start_work = "09:00",
      end_work = "18:00",
      lunch_duration_minutes = 60,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const { data: schedule, error } = await supabase
      .from("work_schedules")
      .insert({
        name: name.trim(),
        tenant_id: profile.tenant_id,
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
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("[Schedules POST] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ schedule });

  } catch (error) {
    console.error("[Schedules POST] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
