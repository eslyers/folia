import { NextResponse, type NextRequest } from "next/server";

// Prevent CDN caching of auth-related pages
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // No-store prevents caching of authenticated pages
  response.headers.set("Cache-Control", "no-store, must-revalidate, max-age=0");
  
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)).*)",
  ],
};