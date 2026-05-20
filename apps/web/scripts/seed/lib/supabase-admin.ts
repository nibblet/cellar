import { createClient } from "@supabase/supabase-js";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

/**
 * Service-role Supabase client used by all seed scripts. Bypasses RLS.
 *
 * Loads env from process.env directly — scripts are run via tsx, which
 * picks up `.env.local` only if you `--env-file=.env.local`. The pnpm
 * scripts in package.json handle that flag.
 */
export function adminClient() {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
