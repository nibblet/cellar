"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SuggestionKind = "feature" | "bug" | "other";

export type SubmitSuggestionState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

async function requireAdminSupabase() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase: null, error: "Not signed in." as const };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return { supabase: null, error: "Not authorized." as const };
  return { supabase, error: null };
}

const VALID_KINDS: SuggestionKind[] = ["feature", "bug", "other"];

export async function submitSuggestion(
  _prev: SubmitSuggestionState,
  formData: FormData,
): Promise<SubmitSuggestionState> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "error", message: "Not signed in." };

  const kindRaw = String(formData.get("kind") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  const kind = VALID_KINDS.includes(kindRaw as SuggestionKind) ? (kindRaw as SuggestionKind) : null;

  if (!kind) return { status: "error", message: "Pick a type." };
  if (!body) return { status: "error", message: "Say a little more." };
  if (body.length > 4000)
    return { status: "error", message: "Too long — keep it under 4000 characters." };

  const { error } = await supabase.from("suggestions").insert({
    member_id: auth.user.id,
    kind,
    body,
  });

  if (error) return { status: "error", message: error.message };

  revalidatePath("/roadmap");
  revalidatePath("/admin/suggestions");
  return { status: "sent" };
}

export type UpdateSuggestionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

const VALID_STATUSES = ["open", "reviewing", "done", "wont-do"] as const;
type SuggestionStatus = (typeof VALID_STATUSES)[number];

export async function updateSuggestionStatus(
  _prev: UpdateSuggestionState,
  formData: FormData,
): Promise<UpdateSuggestionState> {
  const id = String(formData.get("id") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  const status = (VALID_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as SuggestionStatus)
    : null;

  if (!id || !status) return { status: "error", message: "Bad request." };

  const { supabase, error: authError } = await requireAdminSupabase();
  if (!supabase) return { status: "error", message: authError };

  const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
  if (error) return { status: "error", message: error.message };

  revalidatePath("/admin/suggestions");
  return { status: "ok" };
}

export async function deleteSuggestion(
  _prev: UpdateSuggestionState,
  formData: FormData,
): Promise<UpdateSuggestionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { status: "error", message: "Missing id." };

  const { supabase, error: authError } = await requireAdminSupabase();
  if (!supabase) return { status: "error", message: authError };

  const { error } = await supabase.from("suggestions").delete().eq("id", id);
  if (error) return { status: "error", message: error.message };

  revalidatePath("/admin/suggestions");
  return { status: "ok" };
}
