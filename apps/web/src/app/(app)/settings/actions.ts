"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BOURBON_PROOF_BANDS,
  BOURBON_STYLES,
  CATALOG_TIER_CEILING,
  CATALOG_TIER_FLOOR,
  CIGAR_STRENGTHS,
  CIGAR_WRAPPER_BUCKETS,
} from "@/lib/preferences/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type MemberSinceFormState = {
  ok: boolean;
  message: string | null;
};

/**
 * Update the member's self-reported club join date (month + year).
 * Stored as the first of the selected month so we have a valid date type.
 */
export async function updateClubJoinedAt(
  _prev: MemberSinceFormState,
  formData: FormData,
): Promise<MemberSinceFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Not signed in." };

  const monthRaw = formData.get("month");
  const yearRaw = formData.get("year");

  const month = typeof monthRaw === "string" ? Number.parseInt(monthRaw, 10) : Number.NaN;
  const year = typeof yearRaw === "string" ? Number.parseInt(yearRaw, 10) : Number.NaN;
  const currentYear = new Date().getFullYear();

  if (
    Number.isNaN(month) ||
    Number.isNaN(year) ||
    month < 1 ||
    month > 12 ||
    year < 2014 ||
    year > currentYear
  ) {
    return { ok: false, message: "Please choose a valid month and year." };
  }

  // Store as first of month — date type requires a day value.
  const isoDate = `${year}-${String(month).padStart(2, "0")}-01`;

  const { error } = await supabase
    .from("users")
    .update({ club_joined_at: isoDate })
    .eq("id", auth.user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/you/settings");
  revalidatePath("/settings");
  return { ok: true, message: "Saved." };
}

export type PreferencesFormState = {
  ok: boolean;
  message: string | null;
};

export async function savePreferences(
  _prev: PreferencesFormState,
  formData: FormData,
): Promise<PreferencesFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Not signed in." };

  // Whitelist each axis against its vocabulary so a tampered form can't
  // store arbitrary strings.
  const cigar_strengths = formData
    .getAll("cigar_strengths")
    .filter(
      (v): v is string =>
        typeof v === "string" && (CIGAR_STRENGTHS as readonly string[]).includes(v),
    );
  const cigar_wrappers = formData
    .getAll("cigar_wrappers")
    .filter(
      (v): v is string =>
        typeof v === "string" && (CIGAR_WRAPPER_BUCKETS as readonly string[]).includes(v),
    );
  const bourbon_styles = formData
    .getAll("bourbon_styles")
    .filter(
      (v): v is string =>
        typeof v === "string" && (BOURBON_STYLES as readonly string[]).includes(v),
    );
  const bourbon_proof_bands = formData
    .getAll("bourbon_proof_bands")
    .filter(
      (v): v is string =>
        typeof v === "string" && (BOURBON_PROOF_BANDS as readonly string[]).includes(v),
    );

  const max_catalog_tier = parseMaxCatalogTier(formData.get("max_catalog_tier"));

  const { error } = await supabase.from("member_preferences").upsert(
    {
      user_id: auth.user.id,
      cigar_strengths,
      cigar_wrappers,
      bourbon_styles,
      bourbon_proof_bands,
      max_catalog_tier,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath("/you/settings");
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message: "Saved." };
}

function parseMaxCatalogTier(raw: FormDataEntryValue | null): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isInteger(n) && n >= CATALOG_TIER_FLOOR && n <= CATALOG_TIER_CEILING) {
    return n;
  }
  return CATALOG_TIER_FLOOR;
}
