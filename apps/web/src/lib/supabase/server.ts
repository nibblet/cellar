import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads the session from cookies; writes back any refreshed tokens.
 *
 * Always call this fresh inside the request scope — do not memoize across requests.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  // The `cellar` schema is applied at runtime via db.schema; the return is cast
  // to the default-typed client so the app's helpers (typed against the bare
  // SupabaseClient) accept it. The app carries no generated Database types, so
  // this is purely a compile-time convenience.
  return createServerClient(supabaseEnv.url(), supabaseEnv.publishableKey(), {
    db: { schema: "cellar" },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies; middleware handles refresh instead.
        }
      },
    },
  }) as unknown as SupabaseClient;
}
