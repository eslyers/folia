import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const supabase = createClient();
    
    // First, try to check if table exists by selecting from it
    const { error: checkError } = await supabase
      .from("system_logs")
      .select("id")
      .limit(1);
    
    // If table doesn't exist, create it using raw SQL via a workaround
    if (checkError && checkError.message.includes('does not exist')) {
      console.log("[Migration] system_logs table does not exist, creating...");
      
      // Try inserting a dummy record - if it fails because table doesn't exist,
      // we'll need to use a different approach. For now, let's just log and return
      // a message that the admin needs to run the migration manually
      
      return NextResponse.json({
        success: false,
        error: "Table system_logs does not exist. Please run the SQL migration in Supabase dashboard.",
        sql: `CREATE TABLE system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  tenant_id UUID,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`
      }, { status: 400 });
    }
    
    return NextResponse.json({ success: true, message: "system_logs table already exists" });
  } catch (err) {
    console.error("[Migration] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}