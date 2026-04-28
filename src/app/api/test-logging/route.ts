import { NextResponse } from "next/server";
import { logAction, createNotification } from "@/lib/logging";

/**
 * Test endpoint to verify logging is working
 * GET /api/test-logging
 */
export async function GET() {
  try {
    // Test logAction
    await logAction(
      "test_api_call",
      "test",
      { message: "Test logging from API endpoint", timestamp: new Date().toISOString() },
      "test-user-id",
      "test-tenant-id"
    );

    // Test createNotification
    await createNotification(
      "test-user-id",
      "Test Notification",
      "This is a test notification from the API",
      "info",
      "test-tenant-id"
    );

    return NextResponse.json({
      success: true,
      message: "Test log and notification sent. Check system_logs table and notifications table."
    });
  } catch (err) {
    console.error("[Test Logging] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}