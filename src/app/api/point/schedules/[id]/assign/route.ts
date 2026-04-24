import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await request.json();
    const { user_ids } = body;

    if (!Array.isArray(user_ids)) {
      return NextResponse.json({ error: "user_ids must be an array" }, { status: 400 });
    }

    const supabase = await createClient();
    
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
