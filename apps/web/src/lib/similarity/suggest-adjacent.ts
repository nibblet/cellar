import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductType, TraitVector, WheelVector } from "@/lib/wheel";
import { rollUpTraits } from "@/lib/wheel/traits";
import { cosineSimilarity } from "./cosine";

export type AdjacentProduct = {
  product_id: string;
  name: string;
  brand: string | null;
  similarity: number;
  tier: number | null;
  price_usd: number | null;
};

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  type: ProductType;
  trait_vector: TraitVector | null;
  wheel_vector: WheelVector | null;
  specs: Record<string, unknown> | null;
};

type ScoredAdjacent = AdjacentProduct & { similarity: number };

export type SuggestAdjacentOptions = {
  limit?: number;
  minSimilarity?: number;
  tierBand?: number;
  priceBandPct?: number;
  matchTier?: boolean;
};

function readTier(specs: Record<string, unknown> | null): number | null {
  const tier = specs?.tier;
  return typeof tier === "number" && tier >= 1 && tier <= 5 ? tier : null;
}

function readPriceUsd(specs: Record<string, unknown> | null): number | null {
  const price = specs?.price_usd;
  return typeof price === "number" && price > 0 ? price : null;
}

function withinTierBand(
  sourceTier: number | null,
  candidateTier: number | null,
  band: number,
): boolean {
  if (sourceTier === null || candidateTier === null) return true;
  return Math.abs(sourceTier - candidateTier) <= band;
}

function withinPriceBand(
  sourcePrice: number | null,
  candidatePrice: number | null,
  bandPct: number,
): boolean {
  if (sourcePrice === null || candidatePrice === null) return true;
  const delta = sourcePrice * bandPct;
  return candidatePrice >= sourcePrice - delta && candidatePrice <= sourcePrice + delta;
}

function applyTierPriceFilter(
  scored: ScoredAdjacent[],
  sourceTier: number | null,
  sourcePrice: number | null,
  options: { tierBand: number; priceBandPct: number; matchTier: boolean; limit: number },
): ScoredAdjacent[] {
  if (!options.matchTier) {
    return scored.slice(0, options.limit);
  }

  const filter = (tierBand: number, priceBandPct: number) =>
    scored.filter(
      (c) =>
        withinTierBand(sourceTier, c.tier, tierBand) &&
        withinPriceBand(sourcePrice, c.price_usd, priceBandPct),
    );

  let filtered = filter(options.tierBand, options.priceBandPct);
  if (filtered.length >= options.limit) {
    return filtered.slice(0, options.limit);
  }

  filtered = filter(options.tierBand + 1, options.priceBandPct);
  if (filtered.length >= options.limit) {
    return filtered.slice(0, options.limit);
  }

  filtered = filter(options.tierBand + 1, options.priceBandPct + 0.2);
  if (filtered.length >= options.limit) {
    return filtered.slice(0, options.limit);
  }

  return scored.slice(0, options.limit);
}

/**
 * Same-category recommendations by trait-vector cosine similarity.
 * Cigar → similar cigars; bourbon → similar bourbons.
 */
export async function suggestAdjacentProducts(
  supabase: SupabaseClient,
  sourceProductId: string,
  options: SuggestAdjacentOptions = {},
): Promise<AdjacentProduct[]> {
  const {
    limit = 3,
    minSimilarity = 0.45,
    tierBand = 1,
    priceBandPct = 0.35,
    matchTier = false,
  } = options;

  const { data: source } = await supabase
    .from("products")
    .select("id, type, trait_vector, wheel_vector, specs")
    .eq("id", sourceProductId)
    .maybeSingle();

  if (!source) return [];

  const sourceRow = source as ProductRow;
  const sourceVec = resolveTraitVector(sourceRow);
  if (!sourceVec) return [];

  const sourceTier = readTier(sourceRow.specs);
  const sourcePrice = readPriceUsd(sourceRow.specs);
  const productType = sourceRow.type;

  const { data: candidates } = await supabase
    .from("products")
    .select("id, name, brand, type, trait_vector, wheel_vector, specs")
    .eq("type", productType)
    .eq("status", "confirmed")
    .neq("id", sourceProductId);

  if (!candidates) return [];

  const scored = (candidates as ProductRow[])
    .map((c) => {
      const candidateVec = resolveTraitVector(c);
      if (!candidateVec) return null;
      const similarity = cosineSimilarity(sourceVec, candidateVec);
      if (similarity < minSimilarity) return null;
      return {
        product_id: c.id,
        name: c.name,
        brand: c.brand,
        similarity,
        tier: readTier(c.specs),
        price_usd: readPriceUsd(c.specs),
      } satisfies ScoredAdjacent;
    })
    .filter((c): c is ScoredAdjacent => c !== null)
    .sort((a, b) => b.similarity - a.similarity);

  return applyTierPriceFilter(scored, sourceTier, sourcePrice, {
    tierBand,
    priceBandPct,
    matchTier,
    limit,
  });
}

function resolveTraitVector(row: ProductRow): TraitVector | null {
  if (row.trait_vector) return row.trait_vector;
  if (row.wheel_vector && Object.keys(row.wheel_vector).length > 0) {
    return rollUpTraits(row.type, row.wheel_vector);
  }
  return null;
}

export { applyTierPriceFilter, readPriceUsd, readTier, withinPriceBand, withinTierBand };
