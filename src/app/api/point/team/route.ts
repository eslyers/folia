import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const managerId = searchParams.get("manager_id");
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
    const detailed = searchParams.get("detailed") === "true";

    if (!managerId) {
      return NextResponse.json({ error: "manager_id é obrigatório" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Call the RPC which handles all aggregation + expected hours calculation
    const { data: teamRows, error: rpcError } = await supabaseAdmin
      .rpc("get_team_timesheets", {
        p_manager_id: managerId,
        p_year: year,
        p_month: month,
      });

    if (rpcError) {
      console.error("[point/team] RPC error:", rpcError);
      return NextResponse.json({ error: "Erro ao buscar dados da equipe: " + rpcError.message }, { status: 500 });
    }

    if (detailed) {
      // Also return time entries for all team members
      const teamUserIds = (teamRows || []).map((r: any) => r.user_id);
      if (teamUserIds.length === 0) {
        return NextResponse.json({ members: teamRows || [], entries: [] });
      }

      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = new Date(year, month, 0).toISOString().split("T")[0];

      const { data: entries } = await supabaseAdmin
        .from("time_entries")
        .select("*")
        .in("user_id", teamUserIds)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");

      return NextResponse.json({ members: teamRows || [], entries: entries || [] });
    }

    return NextResponse.json({ members: teamRows || [] });
  } catch (error) {
    console.error("[point/team] Error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
