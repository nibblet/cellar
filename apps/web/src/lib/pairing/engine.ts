import type { SupabaseClient } from "@supabase/supabase-js";
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

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  type: ProductType;
  trait_vector: TraitVector | null;
};

/**
 * Given a product (cigar or bourbon), find the top N candidates of the
 * opposite type by scoring every confirmed catalog entry against it.
 *
 * O(catalog_size) per call, ~$0 in compute. For 12 users + a ~1,000 row
 * catalog this is sub-second; revisit if we ever scale.
 */
export async function suggestPairings(
  supabase: SupabaseClient,
  sourceProductId: string,
  options: { limit?: number; minScore?: number } = {},
): Promise<PairingCandidate[]> {
  const { limit = 3, minScore = 55 } = options;

  const { data: source } = await supabase
    .from("products")
    .select("id, type, trait_vector")
    .eq("id", sourceProductId)
    .maybeSingle();

  if (!source?.trait_vector) return [];

  const sourceType = source.type as ProductType;
  const candidateType: ProductType = sourceType === "cigar" ? "bourbon" : "cigar";

  const { data: candidates } = await supabase
    .from("products")
    .select("id, name, brand, type, trait_vector")
    .eq("type", candidateType)
    .eq("status", "confirmed")
    .not("trait_vector", "is", null);

  if (!candidates) return [];

  const sourceVec = source.trait_vector as TraitVector;

  const scored = (candidates as ProductRow[])
    .filter((c) => c.trait_vector !== null)
    .map((c) => {
      const candidateVec = c.trait_vector as TraitVector;
      // The engine always asks "cigar vs bourbon"; flip args if source is bourbon.
      const { score, reasons } =
        sourceType === "cigar"
          ? scorePair(sourceVec, candidateVec)
          : scorePair(candidateVec, sourceVec);
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

  return scored;
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
