import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction, createNotification } from "@/lib/logging";

/**
 * GET /api/point/entries
 * Query params: user_id, date (YYYY-MM-DD), week (boolean)
 * Returns time entries for user/date range
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const dateParam = searchParams.get("date");
  const weekParam = searchParams.get("week");

  if (!userId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Week query - return all entries Mon-Fri of current week
  if (weekParam === "true") {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", userId)
      .gte("date", monday.toISOString().split("T")[0])
      .lte("date", friday.toISOString().split("T")[0])
      .order("date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entries: data });
  }

  // Single date query
  if (dateParam) {
    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", userId)
      .eq("date", dateParam)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entry: data });
  }

  // Default: today's entry
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data });
}

/**
 * POST /api/point/entries
 * Body: { action: "clock_in" | "clock_out" | "lunch_start" | "lunch_end", user_id, date }
 * Creates or updates time_entry
 * On clock_out, calculates total_hours and overtime_hours using user's schedule daily_hours
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, user_id, date } = body;

  if (!action || !user_id || !date) {
    return NextResponse.json(
      { error: "action, user_id, and date are required" },
      { status: 400 }
    );
  }

  const validActions = ["clock_in", "clock_out", "lunch_start", "lunch_end"];
  if (!validActions.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${validActions.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Get current entry or create new one
  const { data: existing, error: fetchError } = await supabase
    .from("time_entries")
    .select("*")
    .eq("user_id", user_id)
    .eq("date", date)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // Get user profile with schedule to know daily_hours and which days are worked
  const { data: profile } = await supabase
    .from("profiles")
    .select("schedule_id")
    .eq("id", user_id)
    .single();

  let dailyHours = 8.0; // default
  const workDays: Record<number, boolean> = {
    0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false,
  };

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

  // Build the update/insert payload
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS

  let payload: Record<string, unknown> = {};
  let shouldCalculate = false;

  switch (action) {
    case "clock_in":
      payload = { clock_in: currentTime, status: "open" };
      break;
    case "lunch_start":
      payload = { lunch_start: currentTime };
      break;
    case "lunch_end":
      payload = { lunch_end: currentTime };
      break;
    case "clock_out":
      payload = { clock_out: currentTime, status: "closed" };
      shouldCalculate = true;
      break;
  }

  let result;
  if (existing) {
    // Merge with existing entry
    const { data, error } = await supabase
      .from("time_entries")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    result = data;
  } else {
    // Create new entry
    const { data, error } = await supabase
      .from("time_entries")
      .insert([{ user_id, date, ...payload }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    result = data;
  }

  // Calculate totals on clock_out using user's schedule daily_hours
  if (shouldCalculate && result) {
    const clockIn = result.clock_in
      ? new Date(`1970-01-01T${result.clock_in}`)
      : null;
    const clockOut = result.clock_out
      ? new Date(`1970-01-01T${result.clock_out}`)
      : null;
    const lunchStart = result.lunch_start
      ? new Date(`1970-01-01T${result.lunch_start}`)
      : null;
    const lunchEnd = result.lunch_end
      ? new Date(`1970-01-01T${result.lunch_end}`)
      : null;

    let totalHours = 0;
    let overtimeHours = 0;

    if (clockIn && clockOut) {
      const workMs = clockOut.getTime() - clockIn.getTime();
      let lunchMs = 0;
      if (lunchStart && lunchEnd) {
        lunchMs = lunchEnd.getTime() - lunchStart.getTime();
      }
      totalHours = Math.max(0, (workMs - lunchMs) / 3_600_000);

      // Expected hours for this day from user's schedule
      const entryDate = new Date(date + "T12:00:00");
      const dow = entryDate.getDay();
      const isWorkDay = workDays[dow] ?? false;
      const expectedHours = isWorkDay ? dailyHours : 0;

      if (totalHours > expectedHours) {
        overtimeHours = totalHours - expectedHours;
      }
    }

    const { data: updated, error: calcError } = await supabase
      .from("time_entries")
      .update({
        total_hours: Math.round(totalHours * 100) / 100,
        overtime_hours: Math.round(overtimeHours * 100) / 100,
      })
      .eq("id", result.id)
      .select()
      .single();

    if (calcError) {
      return NextResponse.json({ error: calcError.message }, { status: 500 });
    }
    result = updated;
  }

  // Logging + notification
  const actionLabel = action.replace("_", " ");
  await logAction(
    action,
    "point_entries",
    { action, user_id, date, entry_id: result?.id, status: result?.status },
    user_id
  );
  await createNotification(
    user_id,
    "Registro de ponto",
    `✅ ${actionLabel} registrado em ${date}`,
    "success"
  );

  return NextResponse.json({ entry: result });
}
