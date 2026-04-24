import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());

    // EXTRACT TOKEN FROM HEADER - Same as schedules API
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

    const tenantId = profile.tenant_id;

    const supabase = await createClient();

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

    // Calculate stats - get ALL employees for the tenant (not just those with time entries)
    const { data: allEmployees } = await supabase
      .from("profiles")
      .select("id, schedule:work_schedules(id, name, daily_hours, monday, tuesday, wednesday, thursday, friday, saturday, sunday)")
      .eq("tenant_id", tenantId)
      .eq("role", "funcionario");

    const employeeCount = (allEmployees || []).length;
    const totalHours = (entries || []).reduce((sum: number, e: any) => sum + (parseFloat(e.total_hours) || 0), 0);
    const totalOvertime = (entries || []).reduce((sum: number, e: any) => sum + (parseFloat(e.overtime_hours) || 0), 0);
    const pendingApproval = (entries || []).filter((e: any) => e.status === "open").length;

    // Calculate total expected hours for the month for ALL employees
    let totalExpected = 0;
    (allEmployees || []).forEach((emp: any) => {
      if (emp.schedule) {
        totalExpected += calculateExpectedMonthlyHours(emp.schedule, year, month);
      } else {
        // Default 8 hours/day if no schedule assigned (~22 working days)
        totalExpected += 8 * 22;
      }
    });

    const stats = {
      total_employees: employeeCount,
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
