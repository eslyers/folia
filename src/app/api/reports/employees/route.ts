import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Check admin auth with Bearer token support
    const authHeader = request.headers.get("Authorization");
    let userId: string | null = null;
    let profile: any = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
      }
      userId = user.id;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
      }
      userId = user.id;
    }

    // Get profile with tenant_id
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role, tenant_id")
      .eq("id", userId)
      .single();

    profile = profileData;

    if (!profile || !['admin', 'tenant_admin', 'master_admin'].includes(profile.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const tenantId = profile.tenant_id;

    // Fetch profiles for this tenant
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name");

    if (profilesError) throw profilesError;

    // Fetch leave requests for employees in this tenant
    const employeeIds = (profiles || []).map((p: any) => p.id);
    const { data: leaveRequests } = await supabase
      .from("leave_requests")
      .select("*")
      .in("user_id", employeeIds.length > 0 ? employeeIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false });

    // Build CSV
    const csvRows: string[] = [];
    
    // Header row
    csvRows.push("Nome,Email,Dias de Ferias,Saldo Horas,Total Pedidos");

    // For each profile, calculate total leave requests
    for (const p of (profiles || [])) {
      const empRequests = (leaveRequests || []).filter((r: any) => r.user_id === p.id);
      const totalRequests = empRequests.length;
      
      const row = [
        escapeCsv(p.name),
        escapeCsv(p.email),
        p.vacation_balance || 0,
        p.hours_balance || 0,
        totalRequests,
      ];
      csvRows.push(row.join(","));
    }

    // Add separator and leave request history section
    csvRows.push(""); // blank line
    csvRows.push("# Historico de Pedidos de Ferias");
    csvRows.push("Employee,Type,Start Date,End Date,Days,Status,Rejection Reason,Created");

    for (const lr of (leaveRequests || [])) {
      const profile = (profiles || []).find((p: any) => p.id === lr.user_id);
      const row = [
        escapeCsv(profile?.name || "Unknown"),
        lr.type,
        lr.start_date,
        lr.end_date,
        lr.days_count,
        lr.status,
        escapeCsv(lr.rejection_reason || ""),
        lr.created_at,
      ];
      csvRows.push(row.join(","));
    }

    const csvContent = csvRows.join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="funcionarios-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });

  } catch (error) {
    console.error("[Reports API] Error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

function escapeCsv(value: string): string {
  if (!value) return "";
  // Escape quotes and wrap if contains comma or newline
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}
