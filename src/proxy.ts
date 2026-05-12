import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/admin", "/dashboard"];

// Routes that require master_admin role
const MASTER_ADMIN_PREFIXES = ["/admin/saas", "/api/tenants"];

// Public routes (no auth required)
const PUBLIC_ROUTES = new Set([
  "/",
  "/landing",
  "/login",
  "/auth/callback",
  "/api/check-notifications",
  "/api/send-notifications",
  "/api/test-notifications",
]);

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname) || pathname.startsWith("/api/public/");
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isMasterAdminRoute(pathname: string): boolean {
  return MASTER_ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static assets and next internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // Allow public routes without auth
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store, must-revalidate, max-age=0");
    return response;
  }

  // Skip auth check for non-protected routes
  if (!isProtectedRoute(pathname) && !pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store, must-revalidate, max-age=0");
    return response;
  }

  // Create Supabase client using SSR cookies
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Validate session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // No session → redirect to login
  if (userError || !user) {
    // API routes return 401 instead of redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For master_admin-only routes, check role from profile
  if (isMasterAdminRoute(pathname)) {
    // Use the Authorization header token if present (API routes)
    // For page routes, fetch from DB
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "master_admin") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Redirect non-master-admins away from SaaS pages
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  // Authenticated — set no-store and pass through
  response.headers.set("Cache-Control", "no-store, must-revalidate, max-age=0");
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT static files and next internals.
     * This runs middleware on every page and API route.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)).*)",
  ],
};
