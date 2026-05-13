import { createBrowserClient } from "@supabase/ssr";

// Singleton client - created once and reused
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  // Return existing client if already created (singleton pattern)
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("[Supabase Client] Environment variables not available");
    return createMockClient() as any;
  }

  // Create and cache the client using SSR to ensure cookie synchronization
  supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey);

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
