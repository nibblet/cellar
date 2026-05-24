import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { loadDailyPourCandidates } from "@/lib/daily-pour/load";
import { loadPickPourCandidates } from "@/lib/pick-pour/load";
import { productMatchesPreferences } from "@/lib/preferences/match";
import type { MemberPreferences } from "@/lib/preferences/types";
import { hasAnyPreferences } from "@/lib/preferences/types";
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

/**
 * Merge cellar-first pairs with catalog pairs, deduped, capped at limit.
 */
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
  preferences: MemberPreferences | null,
): Promise<FindNextSuggestions> {
  const [pairing, pour, smoke] = await Promise.all([
    loadPairingSuggestions(supabase, memberId, preferences),
    loadProductSuggestions(supabase, memberId, preferences, "bourbon"),
    loadProductSuggestions(supabase, memberId, preferences, "cigar"),
  ]);

  return { pairing, pour, smoke };
}

async function loadPairingSuggestions(
  supabase: SupabaseClient,
  memberId: string,
  preferences: MemberPreferences | null,
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
  preferences: MemberPreferences | null,
  productType: "cigar" | "bourbon",
): Promise<FindNextProductSuggestion[]> {
  const cellar = await loadCellarSnapshot(supabase, memberId);

  const haveIds = [...cellar.have];
  let cellarProducts: FindNextProductSuggestion[] = [];

  if (haveIds.length > 0) {
    const { data } = await supabase
      .from("products")
      .select("id, name, brand, type")
      .in("id", haveIds)
      .eq("type", productType)
      .order("name");

    cellarProducts = (
      (data ?? []) as Array<{ id: string; name: string; brand: string | null }>
    ).map((p) => ({
      kind: "product" as const,
      source: "cellar" as const,
      product_id: p.id,
      name: p.name,
      brand: p.brand,
      product_type: productType,
    }));
  }

  const { data: catalogRows } = await supabase
    .from("products")
    .select("id, name, brand, specs")
    .eq("type", productType)
    .eq("status", "confirmed")
    .order("name")
    .limit(150);

  type Row = {
    id: string;
    name: string;
    brand: string | null;
    specs: Record<string, unknown> | null;
  };

  const haveSet = cellar.have;
  const catalog: FindNextProductSuggestion[] = [];

  for (const row of (catalogRows as Row[] | null) ?? []) {
    if (haveSet.has(row.id)) continue;
    if (preferences && hasAnyPreferences(preferences)) {
      if (!productMatchesPreferences({ type: productType, specs: row.specs }, preferences)) {
        continue;
      }
    }
    catalog.push({
      kind: "product",
      source: "catalog",
      product_id: row.id,
      name: row.name,
      brand: row.brand,
      product_type: productType,
    });
    if (catalog.length >= FIND_NEXT_LIMIT * 2) break;
  }

  return mergeProductSuggestions(cellarProducts, catalog);
}
