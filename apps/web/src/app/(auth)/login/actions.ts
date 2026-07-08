"use server";

import { redirect } from "next/navigation";
import { TONIGHT_PATH } from "@/lib/navigation/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "error"; message?: string };

export async function signInWithPassword(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email?.includes("@")) {
    return { status: "error", message: "Enter a valid email address." };
  }
  if (!password) {
    return { status: "error", message: "Enter your password." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Don't leak which field is wrong — generic message is friendlier and safer.
    return { status: "error", message: "Email or password is incorrect." };
  }

  redirect(TONIGHT_PATH);
}
