import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());

    const supabase = await createClient();

    // Check auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, tenant_id")
      .eq("id", session.user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenantId = profile.tenant_id;

    // Get first day of month
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

    // Fetch time entries with profile + schedule data
    const { data: entries, error: entriesError } = await supabase
      .from("time_entries")
      .select(`
        *,
        profile:profiles!user_id(
          id, name, email, department,
          schedule:work_schedules(id, name, daily_hours, monday, tuesday, wednesday, thursday, friday, saturday, sunday)
        )
      `)
      .eq("tenant_id", tenantId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (entriesError) {
      console.error("[Admin Overview] Entries error:", entriesError);
      return NextResponse.json({ error: entriesError.message }, { status: 500 });
    }

    // Calculate stats
    const uniqueEmployees = new Set((entries || []).map((e: any) => e.user_id));
    const totalHours = (entries || []).reduce((sum: number, e: any) => sum + (parseFloat(e.total_hours) || 0), 0);
    const totalOvertime = (entries || []).reduce((sum: number, e: any) => sum + (parseFloat(e.overtime_hours) || 0), 0);
    const pendingApproval = (entries || []).filter((e: any) => e.status === "open").length;

    // Calculate total expected hours for the month
    // Group entries by user to get unique users and their schedules
    const userSchedules = new Map<string, any>();
    (entries || []).forEach((e: any) => {
      if (e.profile?.schedule && !userSchedules.has(e.user_id)) {
        userSchedules.set(e.user_id, e.profile.schedule);
      }
    });

    // Count work days in month for each user and calculate expected
    let totalExpected = 0;
    userSchedules.forEach((schedule) => {
      const expectedMonthly = calculateExpectedMonthlyHours(schedule, year, month);
      totalExpected += expectedMonthly;
    });

    const stats = {
      total_employees: uniqueEmployees.size,
      total_hours: Math.round(totalHours * 100) / 100,
      total_overtime: Math.round(totalOvertime * 100) / 100,
      pending_approval: pendingApproval,
      total_expected_hours: Math.round(totalExpected * 100) / 100,
    };

    return NextResponse.json({ entries: entries || [], stats });

  } catch (error) {
    console.error("[Admin Overview] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function calculateExpectedMonthlyHours(schedule: any, year: number, month: number): number {
  if (!schedule) return 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  let workDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dow = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const dayMap: Record<number, keyof Pick<any, 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'>> = {
      0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday'
    };
    if (schedule[dayMap[dow]]) {
      workDays++;
    }
  }

  return parseFloat(String(schedule.daily_hours || 8)) * workDays;
}
