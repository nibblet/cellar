import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/**
 * Supabase client for client components. Singleton-safe; the SSR helper
 * internally caches the underlying client.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseEnv.url(), supabaseEnv.publishableKey(), {
    // Solo fork lives in an isolated `cellar` schema in the shared project.
    db: { schema: "cellar" },
  }) as unknown as SupabaseClient;
}
