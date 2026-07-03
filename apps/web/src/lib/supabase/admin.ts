import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/**
 * Service-role Supabase client. Bypasses RLS — use ONLY in trusted server
 * contexts (seed scripts, admin actions, invite issuance) and never expose
 * to the browser.
 */
export function createSupabaseAdminClient() {
  return createClient(supabaseEnv.url(), supabaseEnv.serviceRoleKey(), {
    // Solo fork lives in an isolated `cellar` schema in the shared project.
    db: { schema: "cellar" },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as unknown as SupabaseClient;
}
