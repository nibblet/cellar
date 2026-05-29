import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { loadProductTypes, splitIdsByProductType } from "@/lib/products/split-by-type";
import type { ProductType, TraitVector } from "@/lib/wheel";
import { type PairingScore, scorePair } from "./score";

export type PairingCandidate = {
  product_id: string;
  name: string;
  brand: string | null;
  type: ProductType;
  score: number;
  reasons: PairingScore["reasons"];
};

export type RankableProductRow = {
  id: string;
  name: string;
  brand: string | null;
  type: ProductType;
  trait_vector: TraitVector;
};

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  type: ProductType;
  trait_vector: TraitVector | null;
};

export type SuggestPairingsOptions = {
  limit?: number;
  minScore?: number;
  candidatePool?: "catalog" | "shelf";
  memberId?: string;
};

/**
 * Score and rank in-memory product rows against a source trait vector.
 * Used by suggestPairings and unit tests.
 */
export function rankPairingCandidates(
  sourceType: ProductType,
  sourceVec: TraitVector,
  candidates: RankableProductRow[],
  options: { limit?: number; minScore?: number } = {},
): PairingCandidate[] {
  const { limit = 3, minScore = 55 } = options;

  return candidates
    .map((c) => {
      const { score, reasons } =
        sourceType === "cigar"
          ? scorePair(sourceVec, c.trait_vector)
          : scorePair(c.trait_vector, sourceVec);
      return {
        product_id: c.id,
        name: c.name,
        brand: c.brand,
        type: c.type,
        score,
        reasons,
      } satisfies PairingCandidate;
    })
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Given a product (cigar or bourbon), find the top N candidates of the
 * opposite type by scoring catalog entries or the member's Have shelf.
 *
 * O(catalog_size) per call for catalog pool, ~$0 in compute. For 12 users +
 * a ~1,000 row catalog this is sub-second; revisit if we ever scale.
 */
export async function suggestPairings(
  supabase: SupabaseClient,
  sourceProductId: string,
  options: SuggestPairingsOptions = {},
): Promise<PairingCandidate[]> {
  const { limit = 3, minScore = 55, candidatePool = "catalog", memberId } = options;

  const { data: source } = await supabase
    .from("products")
    .select("id, type, trait_vector")
    .eq("id", sourceProductId)
    .maybeSingle();

  if (!source?.trait_vector) return [];

  const sourceType = source.type as ProductType;
  const sourceVec = source.trait_vector as TraitVector;
  const candidateType: ProductType = sourceType === "cigar" ? "bourbon" : "cigar";

  let candidateRows: ProductRow[];

  if (candidatePool === "shelf") {
    if (!memberId) return [];
    candidateRows = await loadShelfCandidateRows(supabase, memberId, candidateType);
  } else {
    const { data: candidates } = await supabase
      .from("products")
      .select("id, name, brand, type, trait_vector")
      .eq("type", candidateType)
      .eq("status", "confirmed")
      .not("trait_vector", "is", null);

    candidateRows = (candidates as ProductRow[] | null) ?? [];
  }

  const rankable = candidateRows
    .filter((c): c is ProductRow & { trait_vector: TraitVector } => c.trait_vector !== null)
    .map((c) => ({
      id: c.id,
      name: c.name,
      brand: c.brand,
      type: c.type,
      trait_vector: c.trait_vector,
    }));

  return rankPairingCandidates(sourceType, sourceVec, rankable, { limit, minScore });
}

async function loadShelfCandidateRows(
  supabase: SupabaseClient,
  memberId: string,
  candidateType: ProductType,
): Promise<ProductRow[]> {
  const cellar = await loadCellarSnapshot(supabase, memberId);
  if (cellar.have.size === 0) return [];

  const haveRows = await loadProductTypes(supabase, cellar.have);
  const { cigars, bourbons } = splitIdsByProductType(haveRows);
  const shelfIds = candidateType === "bourbon" ? bourbons : cigars;
  if (shelfIds.length === 0) return [];

  const { data } = await supabase
    .from("products")
    .select("id, name, brand, type, trait_vector")
    .in("id", shelfIds)
    .eq("status", "confirmed")
    .eq("catalog_included", true)
    .not("trait_vector", "is", null);

  return (data as ProductRow[] | null) ?? [];
}

/**
 * Best opposite-type match on the member's Have shelf. Does not write pairings_cache.
 */
export async function suggestShelfPairing(
  supabase: SupabaseClient,
  memberId: string,
  sourceProductId: string,
  options: { minScore?: number } = {},
): Promise<PairingCandidate | null> {
  const minScore = options.minScore ?? 55;
  const results = await suggestPairings(supabase, sourceProductId, {
    candidatePool: "shelf",
    memberId,
    limit: 1,
    minScore,
  });
  return results[0] ?? null;
}

/**
 * Read-through cache wrapper around suggestPairings. Looks up cached rows
 * for this cigar; if fewer than `limit` exist (or any are stale beyond TTL),
 * recomputes and upserts. Returns sorted by score desc, validated pairs
 * promoted on top.
 *
 * Source is always a CIGAR for the cache key — pairings_cache is keyed
 * (cigar_id, bourbon_id), so we resolve bourbon sources via the inverse.
 */
export async function loadOrComputeTopPairings(
  supabase: SupabaseClient,
  sourceProductId: string,
  options: { limit?: number; minScore?: number } = {},
): Promise<PairingCandidate[]> {
  const limit = options.limit ?? 3;
  const minScore = options.minScore ?? 55;

  const fresh = await suggestPairings(supabase, sourceProductId, { limit, minScore });

  if (fresh.length === 0) return fresh;

  // Persist for the dedicated pairing screen lookup.
  const { data: source } = await supabase
    .from("products")
    .select("type")
    .eq("id", sourceProductId)
    .maybeSingle();

  if (source?.type === "cigar") {
    await supabase.from("pairings_cache").upsert(
      fresh.map((c) => ({
        cigar_id: sourceProductId,
        bourbon_id: c.product_id,
        score: c.score,
        rationale_text: null,
        last_computed_at: new Date().toISOString(),
      })),
      { onConflict: "cigar_id,bourbon_id" },
    );
  } else if (source?.type === "bourbon") {
    await supabase.from("pairings_cache").upsert(
      fresh.map((c) => ({
        cigar_id: c.product_id,
        bourbon_id: sourceProductId,
        score: c.score,
        rationale_text: null,
        last_computed_at: new Date().toISOString(),
      })),
      { onConflict: "cigar_id,bourbon_id" },
    );
  }

  return fresh;
}
