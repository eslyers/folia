import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In Next.js 16, cookies() is readonly in Server Components
          // Cookie setting is handled by the proxy/middleware for incoming requests
          // and by the browser for client-side operations
          try {
            // Try to set cookies (will fail in read-only context)
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as any);
            });
          } catch (e) {
            // Silently ignore - cookies are managed by middleware/proxy
          }
        },
      },
    }
  );
}

// Utility function for API routes that need to set cookies
export function createServerClientWithResponse(cookieHeader: string | null) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (!cookieHeader) return [];
          return cookieHeader.split(";").map((cookie) => {
            const [name, ...rest] = cookie.trim().split("=");
            return { name, value: rest.join("=") };
          }).filter((c) => c.name);
        },
        setAll(cookiesToSet) {
          // API routes can't set cookies directly - use Response cookies
          // This is handled by the middleware/proxy
        },
      },
    }
  );
}