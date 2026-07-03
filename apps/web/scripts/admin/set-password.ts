/**
 * Dev-only escape hatch. Uses the service-role key to upsert an auth user
 * (creates if missing, sets password if existing) without involving the
 * email-confirmation flow. Bypasses the Supabase email templates entirely,
 * which is useful when those templates are misconfigured at the project
 * level (shared with sibling apps) and the password-reset email lands in
 * the wrong place.
 *
 * Usage:
 *   pnpm admin:set-password <email> <password> [first_name] [last_initial]
 *
 * Example:
 *   pnpm admin:set-password paul.cobb@homevestors.com 'choose-something-good' Paul C
 *
 * The first/last fields are only used if a public.users row needs to be
 * created. Existing profiles are left alone.
 */

import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

type ProfileAdminClient = {
  schema(schemaName: string): {
    from(tableName: string): {
      select(columns: string): {
        eq(column: string, value: string): {
          maybeSingle(): Promise<{ data: { id: string } | null }>;
        };
      };
      insert(values: {
        id: string;
        name_first: string;
        name_last_initial: string;
      }): Promise<{ error: Error | null }>;
    };
  };
};

export async function ensureCellarUserProfile({
  supabase,
  userId,
  nameFirst,
  nameLastInitial,
}: {
  supabase: ProfileAdminClient;
  userId: string;
  nameFirst?: string;
  nameLastInitial?: string;
}): Promise<"existing" | "created" | "missing_names"> {
  const users = supabase.schema("cellar").from("users");
  const { data: profile } = await users.select("id").eq("id", userId).maybeSingle();

  if (profile) {
    return "existing";
  }

  if (!nameFirst || !nameLastInitial) {
    return "missing_names";
  }

  const { error } = await supabase.schema("cellar").from("users").insert({
    id: userId,
    name_first: nameFirst,
    name_last_initial: nameLastInitial.charAt(0).toUpperCase(),
  });
  if (error) throw error;

  return "created";
}

async function main() {
  const [email, password, nameFirst, nameLastInitial] = process.argv.slice(2);
  if (!email || !password) {
    console.error(
      "Usage: pnpm admin:set-password <email> <password> [first_name] [last_initial]",
    );
    process.exit(2);
  }

  const supabase = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Look up the auth user. listUsers with a filter avoids paginating the whole table
  // for projects with many users.
  const { data: lookup, error: lookupError } = await supabase.auth.admin.listUsers();
  if (lookupError) throw lookupError;

  const existing = lookup.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  let userId: string;

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`[set-password] updated existing auth user ${userId} (${email})`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    if (!data.user) throw new Error("createUser returned no user");
    userId = data.user.id;
    console.log(`[set-password] created new auth user ${userId} (${email})`);
  }

  // Ensure a cellar.users profile row exists. Only fill in name fields when
  // creating a profile from scratch — leave existing profiles untouched.
  const profileStatus = await ensureCellarUserProfile({
    supabase,
    userId,
    nameFirst,
    nameLastInitial,
  });

  if (profileStatus === "missing_names") {
    console.warn(
      "[set-password] no cellar.users row exists and no name args supplied — auth user created but the (app) layout will redirect to /login until you supply a cellar profile.",
    );
  } else if (profileStatus === "created") {
    console.log(
      `[set-password] inserted cellar.users profile for ${nameFirst} ${nameLastInitial?.charAt(0).toUpperCase()}`,
    );
  } else {
    console.log("[set-password] cellar.users profile already exists; left untouched");
  }

  console.log("[set-password] done.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("[set-password] failed:", err);
    process.exit(1);
  });
}
