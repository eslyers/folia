import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/logging";

/**
 * GET /api/auth/callback
 * Handles OAuth callback from Supabase (e.g., Google sign-in).
 * Extracts auth code from ?code= query param and exchanges it for a session.
 * Redirects based on user role (admin → /admin, others → /dashboard).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  let redirectPath = searchParams.get("next") ?? "/dashboard";

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

      // F-09: Role-based redirect after OAuth login
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role === "master_admin" || profile?.role === "tenant_admin") {
        redirectPath = "/admin";
      } else {
        redirectPath = "/dashboard";
      }
    }
  }

  return NextResponse.redirect(new URL(redirectPath, request.url));
}
