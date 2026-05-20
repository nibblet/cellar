import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/**
 * Supabase client for client components. Singleton-safe; the SSR helper
 * internally caches the underlying client.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseEnv.url(), supabaseEnv.publishableKey());
}
