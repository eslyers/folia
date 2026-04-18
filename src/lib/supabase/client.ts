import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Singleton pattern - create client once and reuse
let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    supabaseInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Use default storage key so existing sessions are found
        // storageKey: 'folia-auth-token', // REMOVED - was breaking auth detection
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