import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Singleton pattern - create client once and reuse
let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  // During build time, env vars might not be available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client for build time
    console.warn("[Supabase Client] Environment variables not available during build, returning mock client");
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

  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  
  return supabaseInstance;
}

// Force refresh - useful when auth state changes
export function getSupabaseSession() {
  const client = createClient();
  return client.auth.getSession();
}