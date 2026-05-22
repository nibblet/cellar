import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCellarBias } from "@/lib/cellar/bias";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import type { CellarSnapshot } from "@/lib/cellar/types";
import { EMPTY_SNAPSHOT } from "@/lib/cellar/types";
import { loadOrComputeTopPairings } from "@/lib/pairing/engine";
import { productMatchesPreferences } from "@/lib/preferences/match";
import type { MemberPreferences } from "@/lib/preferences/types";
import { hasAnyPreferences } from "@/lib/preferences/types";

export type DailyPourCandidate = {
  cigar_id: string;
  cigar_name: string;
  cigar_brand: string | null;
  bourbon_id: string;
  bourbon_name: string;
  bourbon_brand: string | null;
  score: number;
  rationale: string | null;
  club_validated: boolean;
};

/**
 * Build the pool the daily-pour selector picks from.
 *
 * Strategy:
 *   - If the member has preferences and any of the catalog's cigars match
 *     them, pull up to 20 of those cigars, run the pairing engine for each,
 *     and aggregate the top bourbon per cigar.
 *   - If the member has no preferences (or no cigars matched), fall back to
 *     the club-validated rows in pairings_cache.
 *   - If neither yields anything, return [].
 *
 * 20 is a deliberately small upper bound. The selector picks one from this
 * pool deterministically per-day-per-member; rotation works as long as the
 * pool is bigger than one and stable across a 24h window.
 */
export async function loadDailyPourCandidates(
  supabase: SupabaseClient,
  preferences: MemberPreferences | null,
  memberId?: string | null,
): Promise<DailyPourCandidate[]> {
  const cellar = memberId ? await loadCellarSnapshot(supabase, memberId) : EMPTY_SNAPSHOT;

  let candidates: DailyPourCandidate[];

  if (preferences && hasAnyPreferences(preferences)) {
    const personal = await loadPreferenceCandidates(supabase, preferences);
    candidates = personal.length > 0 ? personal : await loadClubValidatedCandidates(supabase);
  } else {
    candidates = await loadClubValidatedCandidates(supabase);
  }

  return applyBias(candidates, cellar);
}

function applyBias(candidates: DailyPourCandidate[], cellar: CellarSnapshot): DailyPourCandidate[] {
  return candidates
    .map((c) => ({
      ...c,
      score: applyCellarBias(c.score, cellar, c.cigar_id, c.bourbon_id),
    }))
    .sort((a, b) => b.score - a.score);
}

async function loadPreferenceCandidates(
  supabase: SupabaseClient,
  preferences: MemberPreferences,
  limit = 5,
): Promise<DailyPourCandidate[]> {
  // Pull a slice of confirmed cigars that carry a trait_vector — without one
  // the pairing engine returns nothing.
  const { data: rawCigars } = await supabase
    .from("products")
    .select("id, name, brand, specs")
    .eq("type", "cigar")
    .eq("status", "confirmed")
    .not("trait_vector", "is", null)
    .limit(200);

  type CigarRow = {
    id: string;
    name: string;
    brand: string | null;
    specs: Record<string, unknown> | null;
  };

  // Cap at `limit` so the daily-pour fetch never burns a server render on
  // dozens of sequential engine calls. Five matches is plenty for daily
  // rotation across a week.
  const matches = ((rawCigars as CigarRow[] | null) ?? [])
    .filter((c) => productMatchesPreferences({ type: "cigar", specs: c.specs }, preferences))
    .slice(0, limit);

  // Parallelize: each pairing computation is independent.
  const computed: (DailyPourCandidate | null)[] = await Promise.all(
    matches.map(async (c): Promise<DailyPourCandidate | null> => {
      const pairs = await loadOrComputeTopPairings(supabase, c.id, { limit: 1 });
      const top = pairs[0];
      if (!top) return null;
      return {
        cigar_id: c.id,
        cigar_name: c.name,
        cigar_brand: c.brand,
        bourbon_id: top.product_id,
        bourbon_name: top.name,
        bourbon_brand: top.brand,
        score: top.score,
        rationale: top.reasons[0]?.reason ?? null,
        club_validated: false,
      };
    }),
  );

  return computed.filter((c): c is DailyPourCandidate => c !== null);
}

async function loadClubValidatedCandidates(
  supabase: SupabaseClient,
  limit = 20,
): Promise<DailyPourCandidate[]> {
  // rationale_text is intentionally not read here. The feed page resolves
  // the picked candidate's prose through loadCachedPairingProse after
  // selection, which knows how to decode the structured JSON shape.
  const { data } = await supabase
    .from("pairings_cache")
    .select(
      "cigar_id, bourbon_id, score, cigar:cigar_id(name, brand), bourbon:bourbon_id(name, brand)",
    )
    .eq("is_group_validated", true)
    .order("score", { ascending: false })
    .limit(limit);

  type Row = {
    cigar_id: string;
    bourbon_id: string;
    score: number;
    cigar: { name: string; brand: string | null } | null;
    bourbon: { name: string; brand: string | null } | null;
  };

  return ((data as unknown as Row[] | null) ?? [])
    .filter((r) => r.cigar && r.bourbon)
    .map(
      (r): DailyPourCandidate => ({
        cigar_id: r.cigar_id,
        cigar_name: r.cigar?.name ?? "",
        cigar_brand: r.cigar?.brand ?? null,
        bourbon_id: r.bourbon_id,
        bourbon_name: r.bourbon?.name ?? "",
        bourbon_brand: r.bourbon?.brand ?? null,
        score: r.score,
        rationale: null,
        club_validated: true,
      }),
    );
}
