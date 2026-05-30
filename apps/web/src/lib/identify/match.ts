import type { SupabaseClient } from "@supabase/supabase-js";
import type { IdentifiedProduct } from "@/lib/openai/identify";
import type { ProductType } from "@/lib/wheel";
import { type CandidateProduct, pickBestMatch } from "./normalize";

const MATCH_THRESHOLD_WITH_BRAND = 0.55;
const MATCH_THRESHOLD_NAME_ONLY = 0.7;
const TOP_CANDIDATES = 3;

export type CatalogMatchResult = {
  productId: string | null;
  matched: boolean;
  confidence: IdentifiedProduct["confidence"];
  extracted: Pick<IdentifiedProduct, "name" | "brand" | "specs" | "notes" | "release_label">;
  topCandidates: CandidateProduct[];
  releaseLabel: string | null;
};

async function fetchCandidates(
  supabase: SupabaseClient,
  type: ProductType,
  brand: string | null,
): Promise<CandidateProduct[]> {
  if (brand) {
    const { data } = await supabase
      .from("products")
      .select("id, name, brand")
      .eq("type", type)
      .eq("status", "confirmed")
      .ilike("brand", `%${brand.split(/\s+/)[0]}%`)
      .limit(50);
    if (data && data.length > 0) return data;
  }

  const { data } = await supabase
    .from("products")
    .select("id, name, brand")
    .eq("type", type)
    .eq("status", "confirmed")
    .limit(200);

  return data ?? [];
}

function rankCandidates(
  candidates: CandidateProduct[],
  extracted: { name: string; brand: string | null },
): CandidateProduct[] {
  const scored = candidates
    .map((product) => {
      const best = pickBestMatch([product], extracted);
      return { product, score: best?.score ?? 0 };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, TOP_CANDIDATES).map((s) => s.product);
}

/**
 * Fuzzy-match vision extraction to the catalog without persisting anything.
 */
export async function matchExtractedToCatalog(
  supabase: SupabaseClient,
  type: ProductType,
  extracted: IdentifiedProduct,
): Promise<CatalogMatchResult> {
  const candidates = await fetchCandidates(supabase, type, extracted.brand);
  const topCandidates = candidates.length > 0 ? rankCandidates(candidates, extracted) : [];

  let productId: string | null = null;
  let matched = false;

  if (candidates.length > 0) {
    const best = pickBestMatch(candidates, { name: extracted.name, brand: extracted.brand });
    if (best) {
      const threshold =
        best.matched === "name+brand" ? MATCH_THRESHOLD_WITH_BRAND : MATCH_THRESHOLD_NAME_ONLY;
      if (best.score >= threshold) {
        productId = best.product.id;
        matched = true;
      }
    }
  }

  const releaseLabel = type === "bourbon" ? extracted.release_label?.trim() || null : null;

  return {
    productId,
    matched,
    confidence: extracted.confidence,
    extracted: {
      name: extracted.name,
      brand: extracted.brand,
      specs: extracted.specs,
      notes: extracted.notes,
      release_label: extracted.release_label,
    },
    topCandidates,
    releaseLabel,
  };
}
