import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import {
  loadOrComputeTopPairings,
  type PairingCandidate,
  suggestShelfPairing,
} from "@/lib/pairing/engine";
import { checkGroupValidation } from "@/lib/pairing/group-validation";
import { loadProductTypes, splitIdsByProductType } from "@/lib/products/split-by-type";
import { cosineSimilarity } from "@/lib/similarity/cosine";
import { suggestAdjacentProducts } from "@/lib/similarity/suggest-adjacent";
import { ensureTasteRecommendations } from "@/lib/taste/load";
import type { TryNextPick } from "@/lib/taste/types";
import type { ProductType, TraitVector } from "@/lib/wheel";
import { pairingIds, sortClubValidatedFirst } from "./rank";
import type { CrossTypePick, ProductSuggestions, ReachForNextPick } from "./types";

const PAIRING_MIN_SCORE = 45;
const REACH_LIMIT = 3;
const SIMILAR_TIER_LIMIT = 3;

type SourceRow = {
  id: string;
  type: ProductType;
  trait_vector: TraitVector | null;
};

async function enrichCrossTypePick(
  supabase: SupabaseClient,
  sourceType: ProductType,
  sourceId: string,
  candidate: PairingCandidate,
  source: "cellar" | "catalog",
  have: Set<string>,
): Promise<CrossTypePick> {
  const ids = pairingIds(sourceType, sourceId, candidate.product_id);
  const validated = await checkGroupValidation(supabase, ids.cigar_id, ids.bourbon_id);
  return {
    ...candidate,
    source,
    onShelf: have.has(candidate.product_id),
    clubValidated: validated !== null,
    ...ids,
  };
}

async function buildCrossTypePick(
  supabase: SupabaseClient,
  sourceType: ProductType,
  sourceId: string,
  candidate: PairingCandidate | null,
  source: "cellar" | "catalog",
  have: Set<string>,
): Promise<CrossTypePick | null> {
  if (!candidate) return null;
  return enrichCrossTypePick(supabase, sourceType, sourceId, candidate, source, have);
}

async function loadReachForNext(
  supabase: SupabaseClient,
  source: SourceRow,
  have: Set<string>,
): Promise<ReachForNextPick[]> {
  if (!source.trait_vector) {
    const adjacent = await suggestAdjacentProducts(supabase, source.id, { limit: REACH_LIMIT });
    return adjacent.map((p) => ({
      ...p,
      onShelf: have.has(p.product_id),
      source: have.has(p.product_id) ? ("cellar" as const) : ("catalog" as const),
    }));
  }

  const sourceVec = source.trait_vector;
  const haveRows = await loadProductTypes(supabase, have);
  const { cigars, bourbons } = splitIdsByProductType(haveRows);
  const sameTypeIds = source.type === "cigar" ? cigars : bourbons;
  const sameTypeIdsFiltered = sameTypeIds.filter((id) => id !== source.id);

  type ShelfRow = {
    id: string;
    name: string;
    brand: string | null;
    trait_vector: TraitVector | null;
    specs: Record<string, unknown> | null;
  };

  let shelfScored: ReachForNextPick[] = [];
  if (sameTypeIdsFiltered.length > 0) {
    const { data } = await supabase
      .from("products")
      .select("id, name, brand, trait_vector, specs")
      .in("id", sameTypeIdsFiltered)
      .eq("status", "confirmed")
      .not("trait_vector", "is", null);

    const mapped = ((data as ShelfRow[] | null) ?? [])
      .map((row): ReachForNextPick | null => {
        if (!row.trait_vector) return null;
        const similarity = cosineSimilarity(sourceVec, row.trait_vector);
        const tier =
          typeof row.specs?.tier === "number" && row.specs.tier >= 1 && row.specs.tier <= 5
            ? row.specs.tier
            : null;
        const price_usd =
          typeof row.specs?.price_usd === "number" && row.specs.price_usd > 0
            ? row.specs.price_usd
            : null;
        return {
          product_id: row.id,
          name: row.name,
          brand: row.brand,
          similarity,
          tier,
          price_usd,
          onShelf: true,
          source: "cellar" as const,
        };
      })
      .filter((x): x is ReachForNextPick => x !== null)
      .sort((a, b) => b.similarity - a.similarity);

    shelfScored = mapped;
  }

  const adjacent = await suggestAdjacentProducts(supabase, source.id, { limit: REACH_LIMIT + 3 });
  const seen = new Set(shelfScored.map((p) => p.product_id));
  const catalog: ReachForNextPick[] = [];

  for (const p of adjacent) {
    if (seen.has(p.product_id) || p.product_id === source.id) continue;
    seen.add(p.product_id);
    catalog.push({
      ...p,
      onShelf: have.has(p.product_id),
      source: "catalog",
    });
    if (catalog.length >= REACH_LIMIT) break;
  }

  return [...shelfScored.slice(0, REACH_LIMIT), ...catalog].slice(0, REACH_LIMIT);
}

function pickHuntNext(
  recommendations: Awaited<ReturnType<typeof ensureTasteRecommendations>>,
  sourceType: ProductType,
  sourceId: string,
  have: Set<string>,
): TryNextPick | null {
  const picks = sourceType === "cigar" ? recommendations.cigars : recommendations.bourbons;
  return picks.find((p) => p.product_id !== sourceId && !have.has(p.product_id)) ?? null;
}

export type LoadProductSuggestionsOptions = {
  pairingMinScore?: number;
};

/**
 * Unified suggestion pipeline for product detail and related surfaces.
 * Cellar boosts shelf picks but catalog fallbacks always populate when possible.
 */
export async function loadProductSuggestions(
  supabase: SupabaseClient,
  sourceProductId: string,
  memberId: string | null,
  options: LoadProductSuggestionsOptions = {},
): Promise<ProductSuggestions | null> {
  const minScore = options.pairingMinScore ?? PAIRING_MIN_SCORE;

  const { data: sourceRow } = await supabase
    .from("products")
    .select("id, type, trait_vector")
    .eq("id", sourceProductId)
    .maybeSingle();

  if (!sourceRow) return null;

  const source = sourceRow as SourceRow;
  const cellar = memberId ? await loadCellarSnapshot(supabase, memberId) : null;
  const have = cellar?.have ?? new Set<string>();

  const [shelfPick, catalogPairings, reachForNext, tasteRecs, similarInTier] = await Promise.all([
    memberId
      ? suggestShelfPairing(supabase, memberId, sourceProductId, { minScore })
      : Promise.resolve(null),
    source.trait_vector
      ? loadOrComputeTopPairings(supabase, sourceProductId, { limit: 5, minScore })
      : Promise.resolve([]),
    loadReachForNext(supabase, source, have),
    memberId ? ensureTasteRecommendations(supabase, memberId) : Promise.resolve(null),
    suggestAdjacentProducts(supabase, sourceProductId, {
      limit: SIMILAR_TIER_LIMIT,
      matchTier: true,
    }),
  ]);

  const tryTonight = await buildCrossTypePick(
    supabase,
    source.type,
    sourceProductId,
    shelfPick,
    "cellar",
    have,
  );

  const catalogEnriched = await Promise.all(
    catalogPairings.map((c) =>
      enrichCrossTypePick(supabase, source.type, sourceProductId, c, "catalog", have),
    ),
  );
  const sortedCatalog = sortClubValidatedFirst(
    catalogEnriched.map((c) => ({ ...c, score: c.score })),
  );

  const tryTonightCatalog =
    sortedCatalog.find((c) => c.product_id !== tryTonight?.product_id) ?? null;

  const topCatalogPair = sortedCatalog[0] ?? null;
  const pairsWellWith = tryTonight ?? tryTonightCatalog ?? topCatalogPair;

  const huntNext =
    tasteRecs && memberId ? pickHuntNext(tasteRecs, source.type, sourceProductId, have) : null;

  return {
    sourceProductId,
    sourceType: source.type,
    tryTonight,
    tryTonightCatalog,
    reachForNext,
    huntNext,
    whileLooking: {
      similarInTier,
      pairsWellWith,
    },
  };
}

/** Best cross-type pick to show: shelf first, then catalog. */
export function primaryTryTonight(suggestions: ProductSuggestions): CrossTypePick | null {
  return suggestions.tryTonight ?? suggestions.tryTonightCatalog;
}

export function pairingHref(cigarId: string, bourbonId: string): string {
  return `/pairings/${cigarId}/${bourbonId}`;
}
