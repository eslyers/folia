import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();

    // Call the pg_notify to reload PostgREST schema cache
    // This notifies the PostgREST service to reload the schema
    const { data, error } = await supabase.rpc('pg_catalog.pg_notify', {
      channel: 'pgrst',
      message: 'reload'
    });

    if (error) {
      console.error("[Reload Schema] Error:", error);
      // Even if RPC fails, try a direct query to verify table exists
      const { data: testData, error: testError } = await supabase
        .from('work_schedules')
        .select('id')
        .limit(1);
      
      if (testError) {
        return NextResponse.json({ 
          success: false, 
          error: testError.message,
          hint: "Check if work_schedules table exists and has daily_hours column"
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        success: true, 
        message: "Schema cache may be reloaded",
        test_result: testData 
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: "PostgREST schema cache reload requested",
      result: data 
    });

  } catch (error: any) {
    console.error("[Reload Schema] Exception:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}