import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BOURBON_PROOF_BANDS,
  BOURBON_STYLES,
  CIGAR_STRENGTHS,
  CIGAR_WRAPPER_BUCKETS,
  EMPTY_PREFERENCES,
  type MemberPreferences,
} from "./types";

type Row = {
  cigar_strengths: string[] | null;
  cigar_wrappers: string[] | null;
  bourbon_styles: string[] | null;
  bourbon_proof_bands: string[] | null;
};

/**
 * Load the current user's preferences (or `EMPTY_PREFERENCES` if no row).
 * Sanitizes stored values against the current vocabulary so that older
 * tokens removed from the enum don't bleed into a feature gate.
 */
export async function loadMemberPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<MemberPreferences> {
  const { data } = await supabase
    .from("member_preferences")
    .select("cigar_strengths, cigar_wrappers, bourbon_styles, bourbon_proof_bands")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return EMPTY_PREFERENCES;

  const row = data as Row;
  return {
    cigar_strengths: filterAgainst(row.cigar_strengths, CIGAR_STRENGTHS),
    cigar_wrappers: filterAgainst(row.cigar_wrappers, CIGAR_WRAPPER_BUCKETS),
    bourbon_styles: filterAgainst(row.bourbon_styles, BOURBON_STYLES),
    bourbon_proof_bands: filterAgainst(row.bourbon_proof_bands, BOURBON_PROOF_BANDS),
  } as MemberPreferences;
}

function filterAgainst<T extends string>(values: string[] | null, allowed: readonly T[]): T[] {
  if (!values) return [];
  const set = new Set<string>(allowed);
  return values.filter((v): v is T => set.has(v));
}
