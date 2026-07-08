"use server";

import { redirect } from "next/navigation";
import { TONIGHT_PATH } from "@/lib/navigation/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UpdatePasswordState = {
  status: "idle" | "error";
  message?: string;
};

const MIN_PASSWORD_LENGTH = 8;

export async function updatePassword(
  _prev: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      status: "error",
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (password !== passwordConfirm) {
    return { status: "error", message: "Passwords don't match." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return {
      status: "error",
      message: "Your reset link has expired. Request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { status: "error", message: error.message };
  }

  redirect(TONIGHT_PATH);
}
