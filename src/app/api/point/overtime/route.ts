import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/point/overtime
 * Query params: user_id, year, month
 * Returns overtime data including expected_monthly_hours based on user's schedule daily_hours
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  if (!userId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  const now = new Date();
  const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

  const supabase = await createClient();

  // Get user's schedule for daily_hours and work days
  let dailyHours = 8.0;
  const workDays: Record<number, boolean> = {
    0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false,
  };

  const { data: profile } = await supabase
    .from("profiles")
    .select("schedule_id")
    .eq("id", userId)
    .single();

  if (profile?.schedule_id) {
    const { data: schedule } = await supabase
      .from("work_schedules")
      .select("daily_hours, monday, tuesday, wednesday, thursday, friday, saturday, sunday")
      .eq("id", profile.schedule_id)
      .maybeSingle();

    if (schedule) {
      dailyHours = parseFloat(String(schedule.daily_hours || 8.0));
      workDays[0] = !!schedule.sunday;
      workDays[1] = !!schedule.monday;
      workDays[2] = !!schedule.tuesday;
      workDays[3] = !!schedule.wednesday;
      workDays[4] = !!schedule.thursday;
      workDays[5] = !!schedule.friday;
      workDays[6] = !!schedule.saturday;
    }
  }

  // Calculate expected monthly hours: count working days in month × daily_hours
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0); // Last day of month
  let workingDaysInMonth = 0;

  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (workDays[dow]) {
      workingDaysInMonth++;
    }
  }

  const expectedMonthlyHours = workingDaysInMonth * dailyHours;

  // Fetch all time entries for the user in the given month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate totals
  let totalOvertimeHours = 0;
  let pendingHours = 0;
  let approvedHours = 0;
  let totalWorkedHours = 0;

  for (const entry of data || []) {
    const ot = parseFloat(String(entry.overtime_hours || 0));
    const total = parseFloat(String(entry.total_hours || 0));
    totalWorkedHours += total;
    totalOvertimeHours += ot;
    if (entry.status === "closed" || entry.status === "adjustment") {
      pendingHours += ot;
    }
  }

  // Check for approved overtime in monthly_timesheets
  const { data: timesheet } = await supabase
    .from("monthly_timesheets")
    .select("approved_overtime_hours, overtime_pending_approval")
    .eq("user_id", userId)
    .eq("month", startDate)
    .maybeSingle();

  if (timesheet) {
    approvedHours = parseFloat(String(timesheet.approved_overtime_hours || 0));
    pendingHours = parseFloat(String(timesheet.overtime_pending_approval || 0));
  }

  // Format as Xh Ym
  const formatHours = (h: number) => {
    if (h <= 0) return "0m";
    const totalMinutes = Math.round(h * 60);
    const hPart = Math.floor(totalMinutes / 60);
    const mPart = totalMinutes % 60;
    if (hPart === 0) return `${mPart}m`;
    if (mPart === 0) return `${hPart}h`;
    return `${hPart}h ${mPart}m`;
  };

  return NextResponse.json({
    total_overtime_hours: Math.round(totalOvertimeHours * 100) / 100,
    pending_hours: Math.round(pendingHours * 100) / 100,
    approved_hours: Math.round(approvedHours * 100) / 100,
    total_worked_hours: Math.round(totalWorkedHours * 100) / 100,
    expected_monthly_hours: Math.round(expectedMonthlyHours * 100) / 100,
    working_days_in_month: workingDaysInMonth,
    daily_hours: dailyHours,
    formatted: {
      total: formatHours(totalOvertimeHours),
      pending: formatHours(pendingHours),
      approved: formatHours(approvedHours),
      expected: formatHours(expectedMonthlyHours),
    },
  });
}
