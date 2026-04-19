import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Check admin auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Get query params for format
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv"; // csv or json

    // Fetch all profiles (employees)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("name");

    if (profilesError) throw profilesError;

    // Fetch all leave requests
    const { data: leaveRequests, error: requestsError } = await supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (requestsError) throw requestsError;

    if (format === "json") {
      return NextResponse.json({ employees: profiles, leave_requests: leaveRequests });
    }

    // Build CSV
    // Header row
    const csvRows: string[] = [];
    
    // Task #8: CSV with nome, email, vacation_balance, hours_balance, total_leave_requests
    csvRows.push("Nome,Email,Dias de Ferias,Saldo Horas,Total Pedidos");

    // For each profile, calculate total leave requests
    for (const p of profiles) {
      const empRequests = leaveRequests.filter((r) => r.user_id === p.id);
      const totalRequests = empRequests.length;
      
      const row = [
        escapeCsv(p.name),
        escapeCsv(p.email),
        p.vacation_balance,
        p.hours_balance,
        totalRequests,
      ];
      csvRows.push(row.join(","));
    }

    // Add separator and leave request history section
    csvRows.push(""); // blank line
    csvRows.push("# Historico de Pedidos de Ferias");
    csvRows.push("Employee,Type,Start Date,End Date,Days,Status,Rejection Reason,Created");

    for (const lr of leaveRequests) {
      const profile = profiles.find((p) => p.id === lr.user_id);
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
