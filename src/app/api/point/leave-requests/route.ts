import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function log(method: string, path: string, action: string, details: Record<string, unknown> = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [LEAVE_REQUESTS] [${method}] ${path} | action=${action} | ${JSON.stringify(details)}`);
}

/**
 * GET /api/point/leave-requests
 * Query params: user_id (optional - filter by user), status (optional), all (boolean - admin sees all)
 * Returns leave requests
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const status = searchParams.get("status");
  const showAll = searchParams.get("all") === "true";

  log("GET", request.url, "LIST_LEAVE_REQUESTS", { userId, status, showAll });

  const supabase = await createClient();

  // Get current user to check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    log("GET", request.url, "AUTH_FAILED", { error: authError?.message });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let query = supabase
    .from("leave_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (showAll) {
    // Admin: show all requests
    query = query;
  } else if (userId) {
    // Filter by specific user
    query = query.eq("user_id", userId);
  } else {
    // Default: show only own requests
    query = query.eq("user_id", user.id);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    log("GET", request.url, "DB_ERROR", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  log("GET", request.url, "SUCCESS", { count: data?.length ?? 0 });
  return NextResponse.json({ leave_requests: data });
}

/**
 * POST /api/point/leave-requests
 * Body: { type, start_date, end_date, days_count, hours_count?, notes?, user_id? }
 * Creates a new leave request. If user_id omitted, uses authenticated user.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, start_date, end_date, days_count, hours_count = 0, notes, user_id } = body;

  log("POST", request.url, "CREATE_LEAVE_REQUEST", { type, start_date, end_date, days_count, hours_count, notes: notes?.slice(0, 50) });

  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    log("POST", request.url, "AUTH_FAILED", { error: authError?.message });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate required fields
  const validTypes = ["vacation", "day_off", "hours", "sick", "other"];
  if (!type || !validTypes.includes(type)) {
    log("POST", request.url, "VALIDATION_ERROR", { error: `type must be one of: ${validTypes.join(", ")}` });
    return NextResponse.json(
      { error: `type must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  if (!start_date || !end_date || !days_count) {
    log("POST", request.url, "VALIDATION_ERROR", { error: "start_date, end_date, and days_count are required" });
    return NextResponse.json(
      { error: "start_date, end_date, and days_count are required" },
      { status: 400 }
    );
  }

  const targetUserId = user_id || user.id;

  const { data, error } = await supabase
    .from("leave_requests")
    .insert([{
      user_id: targetUserId,
      type,
      start_date,
      end_date,
      days_count,
      hours_count,
      notes: notes || null,
      status: "pending",
    }])
    .select()
    .single();

  if (error) {
    log("POST", request.url, "DB_ERROR", { error: error.message, details: body });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  log("POST", request.url, "CREATED", { id: data.id, user_id: targetUserId, status: data.status });
  return NextResponse.json({ leave_request: data }, { status: 201 });
}

/**
 * PUT /api/point/leave-requests
 * Body: { id, action: "approve" | "reject" | "cancel", rejection_reason?, reviewed_by? }
 * Approves, rejects, or cancels a leave request
 */
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, action, rejection_reason, reviewed_by } = body;

  log("PUT", request.url, "UPDATE_LEAVE_REQUEST", { id, action, rejection_reason: rejection_reason?.slice(0, 50) });

  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    log("PUT", request.url, "AUTH_FAILED", { error: authError?.message });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!id || !action) {
    log("PUT", request.url, "VALIDATION_ERROR", { error: "id and action are required" });
    return NextResponse.json(
      { error: "id and action are required" },
      { status: 400 }
    );
  }

  const validActions = ["approve", "reject", "cancel"];
  if (!validActions.includes(action)) {
    log("PUT", request.url, "VALIDATION_ERROR", { error: `action must be one of: ${validActions.join(", ")}` });
    return NextResponse.json(
      { error: `action must be one of: ${validActions.join(", ")}` },
      { status: 400 }
    );
  }

  // Fetch the existing request
  const { data: existing, error: fetchError } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    log("PUT", request.url, "DB_FETCH_ERROR", { id, error: fetchError.message });
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!existing) {
    log("PUT", request.url, "NOT_FOUND", { id });
    return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
  }

  // Determine new status and review fields based on action
  let newStatus: string;
  let updatePayload: Record<string, unknown> = {};

  switch (action) {
    case "approve":
      newStatus = "approved";
      updatePayload = {
        status: newStatus,
        reviewed_by: reviewed_by || user.id,
        reviewed_at: new Date().toISOString(),
      };
      break;
    case "reject":
      newStatus = "rejected";
      updatePayload = {
        status: newStatus,
        rejection_reason: rejection_reason || null,
        reviewed_by: reviewed_by || user.id,
        reviewed_at: new Date().toISOString(),
      };
      break;
    case "cancel":
      newStatus = "cancelled";
      updatePayload = { status: newStatus };
      break;
  }

  const { data, error } = await supabase
    .from("leave_requests")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    log("PUT", request.url, "DB_UPDATE_ERROR", { id, action, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  log("PUT", request.url, "UPDATED", { id, action, newStatus, previousStatus: existing.status });
  return NextResponse.json({ leave_request: data });
}

/**
 * DELETE /api/point/leave-requests
 * Query params: id
 * Deletes a leave request (admin only, or owner if still pending)
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  log("DELETE", request.url, "DELETE_LEAVE_REQUEST", { id });

  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    log("DELETE", request.url, "AUTH_FAILED", { error: authError?.message });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!id) {
    log("DELETE", request.url, "VALIDATION_ERROR", { error: "id query parameter is required" });
    return NextResponse.json({ error: "id query parameter is required" }, { status: 400 });
  }

  // Fetch to check ownership
  const { data: existing, error: fetchError } = await supabase
    .from("leave_requests")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    log("DELETE", request.url, "DB_FETCH_ERROR", { id, error: fetchError.message });
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!existing) {
    log("DELETE", request.url, "NOT_FOUND", { id });
    return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
  }

  // Only owner (pending) or admin can delete
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const isOwner = existing.user_id === user.id;

  if (!isAdmin && !isOwner) {
    log("DELETE", request.url, "FORBIDDEN", { id, userId: user.id, isOwner, isAdmin });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("leave_requests")
    .delete()
    .eq("id", id);

  if (deleteError) {
    log("DELETE", request.url, "DB_DELETE_ERROR", { id, error: deleteError.message });
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  log("DELETE", request.url, "DELETED", { id, deletedBy: user.id });
  return NextResponse.json({ success: true });
}
