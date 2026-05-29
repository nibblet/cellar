import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { loadMemberPreferences } from "@/lib/preferences/load";
import type { MemberPreferences } from "@/lib/preferences/types";
import type { ProductType, TraitVector } from "@/lib/wheel";
import { loadTasteByType, TASTE_TYPES } from "./context";
import { generateRationales, type RationalePick, type TasteProfile } from "./rationale";
import { recommendForType, type TasteCandidate } from "./recommend";
import type { TasteRecommendations, TryNextPick } from "./types";
import { dominantTraits } from "./vector";

const CANDIDATE_LIMIT = 500;
const TYPES = TASTE_TYPES;
// Bump when scoring inputs or candidate filters change so cached picks rebuild.
const SIGNAL_VERSION = "v2-catalog-included";

type ProductRow = {
  id: string;
  type: ProductType;
  name: string;
  brand: string | null;
  image_url: string | null;
  specs: Record<string, unknown> | null;
  trait_vector: TraitVector | null;
};

/**
 * Hash the inputs that should invalidate the cache: the member's tried/loved
 * products (love flagged so a tried→loved promotion re-keys) and their stated
 * preferences. Sorted for stability.
 */
function computeSignalHash(
  triedLoved: Array<{ id: string; loved: boolean }>,
  preferences: MemberPreferences,
): string {
  const ids = triedLoved
    .map((s) => `${s.id}:${s.loved ? 1 : 0}`)
    .sort()
    .join(",");
  const prefs = JSON.stringify({
    s: [...preferences.cigar_strengths].sort(),
    w: [...preferences.cigar_wrappers].sort(),
    b: [...preferences.bourbon_styles].sort(),
    p: [...preferences.bourbon_proof_bands].sort(),
  });
  return createHash("sha256")
    .update(`${SIGNAL_VERSION}|${ids}|${prefs}`)
    .digest("hex")
    .slice(0, 16);
}

async function loadCachedRecommendations(
  supabase: SupabaseClient,
  memberId: string,
): Promise<TasteRecommendations | null> {
  const { data } = await supabase
    .from("users")
    .select("taste_recommendations")
    .eq("id", memberId)
    .maybeSingle();
  const raw = data?.taste_recommendations as TasteRecommendations | null;
  if (!raw || typeof raw.signal_hash !== "string") return null;
  return raw;
}

function toPicks(scored: ReturnType<typeof recommendForType>): TryNextPick[] {
  return scored.map((s) => ({
    product_id: s.candidate.id,
    name: s.candidate.name,
    brand: s.candidate.brand,
    image_url: s.candidate.image_url,
    rationale: "",
  }));
}

const EMPTY_RECOMMENDATIONS = (signalHash: string): TasteRecommendations => ({
  cigars: [],
  bourbons: [],
  signal_hash: signalHash,
  generated_at: new Date().toISOString(),
});

/**
 * Load or build the member's Try Next recommendations. Returns cached picks
 * when the signal hash matches; otherwise re-scores the catalog against the
 * member's palate, writes one batched Winston rationale per pick, caches the
 * result, and returns it.
 *
 * On generation failure we fall back to the stale cache rather than blanking
 * the section.
 */
export async function ensureTasteRecommendations(
  supabase: SupabaseClient,
  memberId: string,
): Promise<TasteRecommendations> {
  const [snapshot, preferences] = await Promise.all([
    loadCellarSnapshot(supabase, memberId),
    loadMemberPreferences(supabase, memberId),
  ]);

  const triedLovedIds = [...new Set([...snapshot.tried, ...snapshot.loved])];
  const signalHash = computeSignalHash(
    triedLovedIds.map((id) => ({ id, loved: snapshot.loved.has(id) })),
    preferences,
  );

  const cached = await loadCachedRecommendations(supabase, memberId);
  if (cached && cached.signal_hash === signalHash) return cached;

  try {
    return await rebuild(supabase, memberId, snapshot, preferences, signalHash);
  } catch (err) {
    console.warn("[taste-recommendations] rebuild failed:", err);
    return cached ?? EMPTY_RECOMMENDATIONS(signalHash);
  }
}

async function rebuild(
  supabase: SupabaseClient,
  memberId: string,
  snapshot: Awaited<ReturnType<typeof loadCellarSnapshot>>,
  preferences: MemberPreferences,
  signalHash: string,
): Promise<TasteRecommendations> {
  // Per-type taste vectors (member's tried/loved) and the confirmed catalog.
  const [byType, candidateRows] = await Promise.all([
    loadTasteByType(supabase, snapshot),
    supabase
      .from("products")
      .select("id, type, name, brand, image_url, specs, trait_vector")
      .eq("status", "confirmed")
      // Never recommend the de-listed long tail. Cigars default true, so this
      // only trims hidden bourbons — same cut-back the member-facing browse uses.
      .eq("catalog_included", true)
      .limit(CANDIDATE_LIMIT),
  ]);

  const candidates = ((candidateRows.data ?? []) as ProductRow[]).map(
    (r): TasteCandidate => ({
      id: r.id,
      type: r.type,
      name: r.name,
      brand: r.brand,
      image_url: r.image_url,
      specs: r.specs,
      traitVector: r.trait_vector,
    }),
  );

  const exclude = new Set<string>([
    ...snapshot.have,
    ...snapshot.want,
    ...snapshot.tried,
    ...snapshot.loved,
  ]);

  const picksByType: Record<ProductType, TryNextPick[]> = { cigar: [], bourbon: [] };
  const profilesByType: Record<ProductType, TasteProfile> = {
    cigar: { traits: [], lovedExamples: [], coldStart: true },
    bourbon: { traits: [], lovedExamples: [], coldStart: true },
  };

  for (const type of TYPES) {
    const { tasteVector, signals } = byType[type];
    const scored = recommendForType({
      type,
      tasteVector,
      signals,
      candidates,
      exclude,
      preferences,
    });
    picksByType[type] = toPicks(scored);
    profilesByType[type] = {
      traits: tasteVector ? dominantTraits(tasteVector) : [],
      lovedExamples: lovedExamplesForType(candidates, snapshot.loved, type),
      coldStart: scored.length > 0 ? scored[0].coldStart : true,
    };
  }

  await attachRationales(supabase, memberId, picksByType, profilesByType, candidates);

  const recommendations: TasteRecommendations = {
    cigars: picksByType.cigar,
    bourbons: picksByType.bourbon,
    signal_hash: signalHash,
    generated_at: new Date().toISOString(),
  };

  await supabase
    .from("users")
    .update({ taste_recommendations: recommendations })
    .eq("id", memberId);

  return recommendations;
}

function lovedExamplesForType(
  candidates: TasteCandidate[],
  lovedIds: ReadonlySet<string>,
  type: ProductType,
): string[] {
  return candidates
    .filter((c) => c.type === type && lovedIds.has(c.id))
    .slice(0, 3)
    .map((c) => (c.brand ? `${c.brand} ${c.name}` : c.name));
}

async function attachRationales(
  supabase: SupabaseClient,
  memberId: string,
  picksByType: Record<ProductType, TryNextPick[]>,
  profilesByType: Record<ProductType, TasteProfile>,
  candidates: TasteCandidate[],
): Promise<void> {
  const byId = new Map(candidates.map((c) => [c.id, c]));

  for (const type of TYPES) {
    const picks = picksByType[type];
    if (picks.length === 0) continue;

    const rationalePicks: RationalePick[] = picks.map((p) => {
      const c = byId.get(p.product_id);
      return {
        productId: p.product_id,
        name: p.name,
        brand: p.brand,
        type,
        specs: c?.specs ?? null,
      };
    });

    const lines = await generateRationales(
      rationalePicks,
      profilesByType[type],
      supabase,
      memberId,
    );
    for (const pick of picks) {
      pick.rationale = lines[pick.product_id] ?? "";
    }
  }
}
