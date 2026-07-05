import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { loadDailyPourCandidates } from "@/lib/daily-pour/load";
import { loadPickPourCandidates } from "@/lib/pick-pour/load";
import { cosineSimilarity } from "@/lib/similarity/cosine";
import { loadTasteByType } from "@/lib/taste/context";
import { ensureTasteRecommendations } from "@/lib/taste/load";
import type { ProductType, TraitVector } from "@/lib/wheel";
import {
  FIND_NEXT_LIMIT,
  type FindNextPairSuggestion,
  type FindNextProductSuggestion,
  type FindNextSuggestions,
} from "./types";

export { FIND_NEXT_LIMIT };

export function pairKey(cigarId: string, bourbonId: string): string {
  return `${cigarId}:${bourbonId}`;
}

export function mergePairSuggestions(
  cellar: FindNextPairSuggestion[],
  catalog: FindNextPairSuggestion[],
  limit = FIND_NEXT_LIMIT,
): FindNextPairSuggestion[] {
  const seen = new Set<string>();
  const out: FindNextPairSuggestion[] = [];

  for (const item of [...cellar, ...catalog]) {
    const key = pairKey(item.cigar_id, item.bourbon_id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }

  return out;
}

export function mergeProductSuggestions(
  cellar: FindNextProductSuggestion[],
  catalog: FindNextProductSuggestion[],
  limit = FIND_NEXT_LIMIT,
): FindNextProductSuggestion[] {
  const seen = new Set<string>();
  const out: FindNextProductSuggestion[] = [];

  for (const item of [...cellar, ...catalog]) {
    if (seen.has(item.product_id)) continue;
    seen.add(item.product_id);
    out.push(item);
    if (out.length >= limit) break;
  }

  return out;
}

export async function loadFindNextSuggestions(
  supabase: SupabaseClient,
  memberId: string,
  preferences: import("@/lib/preferences/types").MemberPreferences | null,
): Promise<FindNextSuggestions> {
  const [pairing, pour, smoke] = await Promise.all([
    loadPairingSuggestions(supabase, memberId, preferences),
    loadProductSuggestions(supabase, memberId, "bourbon"),
    loadProductSuggestions(supabase, memberId, "cigar"),
  ]);

  return { pairing, pour, smoke };
}

async function loadPairingSuggestions(
  supabase: SupabaseClient,
  memberId: string,
  preferences: import("@/lib/preferences/types").MemberPreferences | null,
): Promise<FindNextPairSuggestion[]> {
  const [cellarRaw, catalogRaw] = await Promise.all([
    loadPickPourCandidates(supabase, memberId),
    loadDailyPourCandidates(supabase, preferences, memberId),
  ]);

  const cellar: FindNextPairSuggestion[] = cellarRaw
    .sort((a, b) => b.score - a.score)
    .map((p) => ({
      kind: "pairing" as const,
      source: "cellar" as const,
      cigar_id: p.cigar_id,
      cigar_name: p.cigar_name,
      cigar_brand: p.cigar_brand,
      bourbon_id: p.bourbon_id,
      bourbon_name: p.bourbon_name,
      bourbon_brand: p.bourbon_brand,
      score: p.score,
      club_validated: p.club_validated,
    }));

  const catalog: FindNextPairSuggestion[] = catalogRaw
    .sort((a, b) => b.score - a.score)
    .map((p) => ({
      kind: "pairing" as const,
      source: "catalog" as const,
      cigar_id: p.cigar_id,
      cigar_name: p.cigar_name,
      cigar_brand: p.cigar_brand,
      bourbon_id: p.bourbon_id,
      bourbon_name: p.bourbon_name,
      bourbon_brand: p.bourbon_brand,
      score: p.score,
      club_validated: p.club_validated,
    }));

  return mergePairSuggestions(cellar, catalog);
}

async function loadProductSuggestions(
  supabase: SupabaseClient,
  memberId: string,
  productType: ProductType,
): Promise<FindNextProductSuggestion[]> {
  const [cellar, recommendations] = await Promise.all([
    loadCellarSnapshot(supabase, memberId),
    ensureTasteRecommendations(supabase, memberId),
  ]);

  const tasteByType = await loadTasteByType(supabase, cellar);
  const tasteVector = tasteByType[productType].tasteVector;

  const haveIds = [...cellar.have];
  let cellarProducts: FindNextProductSuggestion[] = [];

  if (haveIds.length > 0) {
    const { data } = await supabase
      .from("products")
      .select("id, name, brand, type, trait_vector")
      .in("id", haveIds)
      .eq("type", productType)
      .eq("status", "confirmed");

    type Row = {
      id: string;
      name: string;
      brand: string | null;
      trait_vector: TraitVector | null;
    };

    const rows = (data ?? []) as Row[];

    cellarProducts = rows
      .map((p) => {
        const score =
          tasteVector && p.trait_vector ? cosineSimilarity(tasteVector, p.trait_vector) : 0;
        return { row: p, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ row }) => ({
        kind: "product" as const,
        source: "cellar" as const,
        product_id: row.id,
        name: row.name,
        brand: row.brand,
        product_type: productType,
        suggestion_kind: "try_tonight" as const,
      }));
  }

  const tastePicks = productType === "cigar" ? recommendations.cigars : recommendations.bourbons;
  const catalog: FindNextProductSuggestion[] = tastePicks.map((p) => ({
    kind: "product" as const,
    source: "catalog" as const,
    product_id: p.product_id,
    name: p.name,
    brand: p.brand,
    product_type: productType,
    suggestion_kind: "hunt_next" as const,
    rationale: p.rationale,
  }));

  // Keep separate headroom for Try Next (cellar) and Hunt Next (catalog). A shared
  // merge cap starves catalog picks when the member has a large Have shelf.
  return [
    ...cellarProducts.slice(0, FIND_NEXT_LIMIT),
    ...catalog.slice(0, FIND_NEXT_LIMIT),
  ];
}
