"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ResetPasswordState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

export async function requestPasswordReset(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email?.includes("@")) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const supabase = await createSupabaseServerClient();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

  // Force the recovery email to point back to NCCC's update-password page,
  // not whatever the project-wide default is.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  // Always show success — don't leak whether the email is registered.
  return { status: "sent" };
}
