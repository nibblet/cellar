"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UpsertMeetupState = {
  status: "idle" | "ok" | "error";
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

export async function upsertMeetup(
  _prev: UpsertMeetupState,
  formData: FormData,
): Promise<UpsertMeetupState> {
  const name = String(formData.get("name") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const eventId = String(formData.get("event_id") ?? "").trim() || null;

  if (!name) return { status: "error", message: "Name is required." };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: "error", message: "Pick a valid date." };
  }

  const { supabase, error: authError } = await requireAdminSupabase();
  if (!supabase) return { status: "error", message: authError };

  if (eventId) {
    const { error } = await supabase
      .from("events")
      .update({ name, date, notes })
      .eq("id", eventId);
    if (error) return { status: "error", message: error.message };
  } else {
    const { error } = await supabase.from("events").insert({ name, date, notes });
    if (error) return { status: "error", message: error.message };
  }

  revalidatePath("/admin/meetup");
  revalidatePath("/");
  return { status: "ok", message: "Saved." };
}

export async function deleteMeetup(
  _prev: UpsertMeetupState,
  formData: FormData,
): Promise<UpsertMeetupState> {
  const eventId = String(formData.get("event_id") ?? "").trim();
  if (!eventId) return { status: "error", message: "No event to delete." };

  const { supabase, error: authError } = await requireAdminSupabase();
  if (!supabase) return { status: "error", message: authError };

  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) return { status: "error", message: error.message };

  revalidatePath("/admin/meetup");
  revalidatePath("/");
  return { status: "ok", message: "Deleted." };
}
