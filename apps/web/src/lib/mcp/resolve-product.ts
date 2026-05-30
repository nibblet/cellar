import type { SupabaseClient } from "@supabase/supabase-js";
import { type CatalogSearchOptions, searchCatalogProducts } from "@/lib/catalog/search";
import { type CandidateProduct, pickBestMatch } from "@/lib/identify/normalize";
import type { ProductType } from "@/lib/wheel";

export const DISAMBIGUATION_SCORE_GAP = 0.05;

export type ResolvedCandidate = CandidateProduct & {
  score: number;
  type: ProductType;
};

export type ResolveProductResult = {
  matched: boolean;
  productId: string | null;
  confidence: number;
  candidates: ResolvedCandidate[];
};

export type ResolveProductOptions = {
  query: string;
  type?: ProductType | "all";
  limit?: number;
};

function rankSearchResults(
  rows: Array<{ id: string; name: string; brand: string | null; type: ProductType }>,
  query: string,
): ResolvedCandidate[] {
  if (rows.length === 0) return [];

  const scored = rows
    .map((row) => {
      const best = pickBestMatch([{ id: row.id, name: row.name, brand: row.brand }], {
        name: query,
        brand: null,
      });
      return {
        id: row.id,
        name: row.name,
        brand: row.brand,
        type: row.type,
        score: best?.score ?? 0,
      } satisfies ResolvedCandidate;
    })
    .sort((a, b) => b.score - a.score);

  return scored;
}

function isAmbiguous(ranked: ResolvedCandidate[]): boolean {
  if (ranked.length < 2) return false;
  const top = ranked[0]?.score ?? 0;
  const second = ranked[1]?.score ?? 0;
  return top - second < DISAMBIGUATION_SCORE_GAP;
}

/**
 * Resolve a natural-language product name to a catalog row.
 * Returns top candidates when the match is ambiguous or weak.
 */
export async function resolveProductByQuery(
  supabase: SupabaseClient,
  options: ResolveProductOptions,
): Promise<ResolveProductResult> {
  const { query, type = "all", limit = 3 } = options;

  const searchOptions: CatalogSearchOptions = { query, type, limit: 60 };
  const rows = await searchCatalogProducts(supabase, searchOptions);
  const ranked = rankSearchResults(rows, query).slice(0, Math.max(limit, 3));

  if (ranked.length === 0) {
    return { matched: false, productId: null, confidence: 0, candidates: [] };
  }

  const top = ranked[0];
  if (!top || top.score < 0.4) {
    return {
      matched: false,
      productId: null,
      confidence: top?.score ?? 0,
      candidates: ranked.slice(0, limit),
    };
  }

  if (isAmbiguous(ranked)) {
    return {
      matched: false,
      productId: null,
      confidence: top.score,
      candidates: ranked.slice(0, limit),
    };
  }

  return {
    matched: true,
    productId: top.id,
    confidence: top.score,
    candidates: ranked.slice(0, limit),
  };
}
