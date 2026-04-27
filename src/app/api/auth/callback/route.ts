import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/logging";

/**
 * GET /api/auth/callback
 * Handles OAuth callback from Supabase (e.g., Google sign-in).
 * Extracts auth code from ?code= query param and exchanges it for a session.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && user) {
      await logAction(
        "oauth_login",
        "auth",
        { provider: "oauth", user_id: user.id, email: user.email },
        user.id
      );
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
