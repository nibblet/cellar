"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireAdminSupabase() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase: null, userId: null, error: "Not signed in." as const };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { supabase: null, userId: null, error: "Not authorized." as const };
  }
  return { supabase, userId: auth.user.id, error: null };
}

export type CreateInviteState = {
  status: "idle" | "created" | "error";
  message?: string;
  token?: string;
  expiresAt?: string;
};

/**
 * URL-safe single-use invite token. randomUUID without hyphens is 32 chars
 * of [a-f0-9] — easy to type into Slack, not too long for a query param.
 */
function generateToken(): string {
  return randomUUID().replace(/-/g, "");
}

const TTL_DAYS = 14;

export async function createInvite(
  _prev: CreateInviteState,
  _formData: FormData,
): Promise<CreateInviteState> {
  const { supabase, userId, error: authError } = await requireAdminSupabase();
  if (!supabase || !userId) return { status: "error", message: authError ?? "Not signed in." };

  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const token = generateToken();

  const { error } = await supabase.from("invites").insert({
    token,
    created_by: userId,
    expires_at: expiresAt,
  });

  if (error) return { status: "error", message: error.message };

  revalidatePath("/admin/invites");
  return { status: "created", token, expiresAt };
}

export type RevokeInviteState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

export async function revokeInvite(
  _prev: RevokeInviteState,
  formData: FormData,
): Promise<RevokeInviteState> {
  const inviteId = String(formData.get("invite_id") ?? "");
  if (!inviteId) return { status: "error", message: "Missing invite id." };

  const { supabase, error: authError } = await requireAdminSupabase();
  if (!supabase) return { status: "error", message: authError };

  const { error } = await supabase.from("invites").delete().eq("id", inviteId);
  if (error) return { status: "error", message: error.message };

  revalidatePath("/admin/invites");
  return { status: "ok" };
}
