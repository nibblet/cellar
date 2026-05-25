"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PENDING_SIGNUP_COOKIE, type PendingSignup } from "./constants";

export type AcceptInviteState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

const MIN_PASSWORD_LENGTH = 8;

export async function acceptInvite(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const token = String(formData.get("token") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");
  const name_first = String(formData.get("name_first") ?? "").trim();
  const name_last_initial = String(formData.get("name_last_initial") ?? "")
    .trim()
    .charAt(0)
    .toUpperCase();

  if (!token) return { status: "error", message: "Missing invite token." };
  if (!email?.includes("@")) {
    return { status: "error", message: "Enter a valid email address." };
  }
  if (!name_first) return { status: "error", message: "Enter your first name." };
  if (!name_last_initial || !/^[A-Z]$/.test(name_last_initial)) {
    return { status: "error", message: "Last initial must be a single letter." };
  }
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

  const { data: inviteId, error: validateError } = await supabase.rpc("validate_invite_token", {
    token_param: token,
  });

  if (validateError || !inviteId) {
    return { status: "error", message: "Invite is invalid, expired, or already used." };
  }

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Force any confirmation email to point back to NCCC, not a sibling app
      // that shares this Supabase project.
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (signUpError) {
    return { status: "error", message: signUpError.message };
  }

  // Case A: project has email confirmation OFF — signUp returns an active
  // session. Create the profile and consume the invite now.
  if (signUpData.session) {
    if (signUpData.user) {
      const { error: insertError } = await supabase.from("users").insert({
        id: signUpData.user.id,
        name_first,
        name_last_initial,
      });
      if (insertError) {
        return { status: "error", message: `Couldn't finish signup: ${insertError.message}` };
      }
      await supabase.rpc("consume_invite_token", { token_param: token });
    }
    redirect("/welcome");
  }

  // Case B: confirmation email pending. Stash the profile bits so the callback
  // can finish creation after the user clicks the link in their inbox.
  const pending: PendingSignup = { token, name_first, name_last_initial };
  const cookieStore = await cookies();
  cookieStore.set(PENDING_SIGNUP_COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60,
    path: "/",
  });

  return { status: "sent" };
}
