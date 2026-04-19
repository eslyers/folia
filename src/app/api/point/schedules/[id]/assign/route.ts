import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const { user_ids } = body;

    if (!Array.isArray(user_ids)) {
      return NextResponse.json({ error: "user_ids must be an array" }, { status: 400 });
    }

    // Assign schedule to all specified users
    const updates = user_ids.map((userId: string) =>
      supabase
        .from("profiles")
        .update({ schedule_id: id })
        .eq("id", userId)
        .eq("tenant_id", profile.tenant_id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter((r) => r.error);

    if (errors.length > 0) {
      console.error("[Assign Schedule] Errors:", errors.map((e) => e.error));
      return NextResponse.json({ error: "Some assignments failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, assigned: user_ids.length });

  } catch (error) {
    console.error("[Assign Schedule] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
