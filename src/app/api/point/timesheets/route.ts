import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

    if (!userId) {
      return NextResponse.json({ error: "user_id é obrigatório" }, { status: 400 });
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

    const monthDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    // Get monthly timesheet record
    const { data: timesheet } = await supabaseAdmin
      .from("monthly_timesheets")
      .select("*")
      .eq("user_id", userId)
      .eq("month", monthDate)
      .maybeSingle();

    // Get time entries
    const { data: entries } = await supabaseAdmin
      .from("time_entries")
      .select("*")
      .eq("user_id", userId)
      .gte("date", monthDate)
      .lte("date", endDate)
      .order("date");

    return NextResponse.json({ timesheet, entries: entries || [] });
  } catch (error) {
    console.error("[timesheets GET] Error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, year, month, action, entry_id } = body;

    if (!user_id || !year || !month || !action) {
      return NextResponse.json({ error: "user_id, year, month e action são obrigatórios" }, { status: 400 });
    }

    const validActions = ["approve_all", "reject_all", "approve_day", "reject_day"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: "action inválida" }, { status: 400 });
    }

    if ((action === "approve_day" || action === "reject_day") && !entry_id) {
      return NextResponse.json({ error: "entry_id é obrigatório para approve_day/reject_day" }, { status: 400 });
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

    const monthDate = `${year}-${String(month).padStart(2, "0")}-01`;

    // Fetch current state
    const { data: currentTs } = await supabaseAdmin
      .from("monthly_timesheets")
      .select("*")
      .eq("user_id", user_id)
      .eq("month", monthDate)
      .maybeSingle();

    if (action === "approve_all") {
      const totalOvertime = currentTs ? parseFloat(String(currentTs.total_overtime_hours)) || 0 : 0;

      const upsertData = {
        user_id,
        month: monthDate,
        tenant_id: currentTs?.tenant_id || "00000000-0000-0000-0000-000000000000",
        total_overtime_hours: totalOvertime,
        approved_overtime_hours: totalOvertime,
        overtime_pending_approval: 0,
        status: "approved",
        approved_by: session.user.id,
        approved_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from("monthly_timesheets")
        .upsert(upsertData, { onConflict: "user_id,month" });

      if (error) {
        console.error("[timesheets PUT] approve_all error:", error);
        return NextResponse.json({ error: "Erro ao aprovar horas extras" }, { status: 500 });
      }

      return NextResponse.json({ success: true, status: "approved", approved_overtime_hours: totalOvertime });
    }

    if (action === "reject_all") {
      const upsertData = {
        user_id,
        month: monthDate,
        tenant_id: currentTs?.tenant_id || "00000000-0000-0000-0000-000000000000",
        total_overtime_hours: currentTs ? parseFloat(String(currentTs.total_overtime_hours)) || 0 : 0,
        approved_overtime_hours: 0,
        overtime_pending_approval: 0,
        status: "rejected",
        approved_by: session.user.id,
        approved_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from("monthly_timesheets")
        .upsert(upsertData, { onConflict: "user_id,month" });

      if (error) {
        console.error("[timesheets PUT] reject_all error:", error);
        return NextResponse.json({ error: "Erro ao rejeitar horas extras" }, { status: 500 });
      }

      return NextResponse.json({ success: true, status: "rejected", approved_overtime_hours: 0 });
    }

    if (action === "approve_day" || action === "reject_day") {
      const { data: entry } = await supabaseAdmin
        .from("time_entries")
        .select("id, overtime_hours")
        .eq("id", entry_id)
        .single();

      if (!entry) {
        return NextResponse.json({ error: "Entrada não encontrada" }, { status: 404 });
      }

      const overtimeHours = parseFloat(String(entry.overtime_hours)) || 0;

      if (currentTs) {
        const currentApproved = parseFloat(String(currentTs.approved_overtime_hours)) || 0;
        const currentPending = parseFloat(String(currentTs.overtime_pending_approval)) || 0;

        const newApproved = action === "approve_day"
          ? currentApproved + overtimeHours
          : currentApproved;

        const newPending = action === "approve_day"
          ? Math.max(0, currentPending - overtimeHours)
          : currentPending;

        const newStatus = newPending === 0 && newApproved > 0 ? "approved" : currentTs.status;

        await supabaseAdmin
          .from("monthly_timesheets")
          .update({
            approved_overtime_hours: newApproved,
            overtime_pending_approval: newPending,
            status: newStatus,
            approved_by: session.user.id,
            approved_at: new Date().toISOString(),
          })
          .eq("id", currentTs.id);
      } else if (action === "approve_day") {
        // Create timesheet record if it doesn't exist
        const { error } = await supabaseAdmin
          .from("monthly_timesheets")
          .insert({
            user_id,
            month: monthDate,
            tenant_id: "00000000-0000-0000-0000-000000000000",
            total_overtime_hours: overtimeHours,
            approved_overtime_hours: overtimeHours,
            overtime_pending_approval: 0,
            status: "approved",
            approved_by: session.user.id,
            approved_at: new Date().toISOString(),
          });

        if (error) {
          console.error("[timesheets PUT] approve_day insert error:", error);
          return NextResponse.json({ error: "Erro ao aprovar entrada" }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Ação não reconhecida" }, { status: 400 });
  } catch (error) {
    console.error("[timesheets PUT] Error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
