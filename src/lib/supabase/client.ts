import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Singleton client - created once and reused
let supabaseClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  // Return existing client if already created (singleton pattern)
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("[Supabase Client] Environment variables not available");
    return createMockClient();
  }

  // Create and cache the client
  supabaseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return supabaseClient;
}

// Fallback mock client for build time
function createMockClient() {
  return {
    from: () => ({ 
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }), limit: () => ({ data: [], error: null }) }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) })
    }),
    auth: { 
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signOut: () => Promise.resolve({ error: null })
    }
  } as any;
}

// Force refresh - useful when auth state changes
export function getSupabaseSession() {
  const client = createClient();
  return client.auth.getSession();
}
