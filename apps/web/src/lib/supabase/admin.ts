import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/**
 * Service-role Supabase client. Bypasses RLS — use ONLY in trusted server
 * contexts (seed scripts, admin actions, invite issuance) and never expose
 * to the browser.
 */
export function createSupabaseAdminClient() {
  return createClient(supabaseEnv.url(), supabaseEnv.serviceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
