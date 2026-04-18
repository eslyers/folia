import { NextResponse } from "next/server";
import { createServerClientWithResponse } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerClientWithResponse(null);
    
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("*");

    if (usersError) {
      throw new Error("Failed to fetch users");
    }

    const testNotifications = [];
    const today = new Date().toISOString().split('T')[0];

    for (const user of users) {
      // Create a test notification for the first user
      if (testNotifications.length === 0) {
        testNotifications.push({
          user_id: user.id,
          user_email: user.email,
          user_name: user.name,
          type: "upcoming_leave",
          leave_type: "vacation",
          leave_start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
          leave_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days from now
          days_until: 7,
          days_count: 7,
          message: `Suas férias começam em 7 dias (teste)`
        });

        testNotifications.push({
          user_id: user.id,
          user_email: user.email,
          user_name: user.name,
          type: "approval_approved",
          leave_type: "day_off",
          leave_start: today,
          leave_end: today,
          days_count: 1,
          message: `Seu pedido de folga foi aprovado!`
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: "Test notifications created",
      notifications: testNotifications,
      count: testNotifications.length 
    });
  } catch (error) {
    console.error("Error creating test notifications:", error);
    return NextResponse.json({ error: "Failed to create test notifications" }, { status: 500 });
  }
}