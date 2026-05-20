"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type State = { status: "idle" | "sent" | "error"; message?: string };

export async function requestMagicLink(_prev: State, formData: FormData): Promise<State> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email?.includes("@")) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const supabase = await createSupabaseServerClient();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Magic-link flow — no account creation here. Acceptance happens at /accept-invite.
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return { status: "sent" };
}
