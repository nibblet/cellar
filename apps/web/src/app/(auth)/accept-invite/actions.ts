"use server";

import { cookies, headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PENDING_SIGNUP_COOKIE, type PendingSignup } from "./constants";

type State = { status: "idle" | "sent" | "error"; message?: string };

export async function acceptInvite(_prev: State, formData: FormData): Promise<State> {
  const token = String(formData.get("token") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
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

  const supabase = await createSupabaseServerClient();

  const { data: inviteId, error: validateError } = await supabase.rpc("validate_invite_token", {
    token_param: token,
  });

  if (validateError || !inviteId) {
    return { status: "error", message: "Invite is invalid, expired, or already used." };
  }

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (otpError) {
    return { status: "error", message: otpError.message };
  }

  // Stash signup details so the callback can finish creating the public.users row
  // and consuming the invite once the magic link is clicked.
  const pending: PendingSignup = { token, name_first, name_last_initial };
  const cookieStore = await cookies();
  cookieStore.set(PENDING_SIGNUP_COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60, // 1 hour to click the link
    path: "/",
  });

  return { status: "sent" };
}
