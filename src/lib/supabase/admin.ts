import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Singleton pattern - create client once and reuse
let adminInstance: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  // During build time, env vars might not be available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    // Return a mock client for build time
    console.warn("[Supabase Admin] Environment variables not available during build, returning mock client");
    return {
      from: () => ({ 
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) })
      }),
      auth: { 
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        getSession: () => Promise.resolve({ data: { session: null }, error: null })
      }
    } as any;
  }

  if (!adminInstance) {
    adminInstance = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  
  return adminInstance;
}