import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Get auth token from header
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
    const { user_ids, effective_date } = body;

    if (!Array.isArray(user_ids)) {
      return NextResponse.json({ error: "user_ids must be an array" }, { status: 400 });
    }

    // Default to today if no effective_date provided
    const effectiveFrom = effective_date || new Date().toISOString().split('T')[0];

    const supabase = await createClient();
    
    // Assign schedule to all specified users using the history function
    const assigned: string[] = [];
    const errors: string[] = [];

    for (const uid of user_ids) {
      const { data, error } = await supabase.rpc('assign_user_schedule', {
        p_user_id: uid,
        p_schedule_id: id,
        p_effective_from: effectiveFrom,
        p_reason: `Schedule assigned by admin: ${profile.role}`
      });

      if (error) {
        console.error(`[Assign Schedule] Error for user ${uid}:`, error);
        errors.push(uid);
      } else {
        assigned.push(uid);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ 
        error: "Some assignments failed", 
        assigned: assigned.length,
        failed: errors.length 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, assigned: assigned.length });

  } catch (error) {
    console.error("[Assign Schedule] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
