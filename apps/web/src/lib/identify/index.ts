import type { SupabaseClient } from "@supabase/supabase-js";
import { identifyProductFromImage } from "@/lib/openai/identify";
import type { ProductType } from "@/lib/wheel";
import { type CandidateProduct, pickBestMatch } from "./normalize";

export type IdentifyOutcome = {
  productId: string;
  matched: boolean;
  confidence: "high" | "medium" | "low";
};

type OrchestrateArgs = {
  supabase: SupabaseClient;
  userId: string;
  imagePublicUrl: string;
  storagePath: string;
  expectedType: ProductType;
};

const MATCH_THRESHOLD_WITH_BRAND = 0.55;
const MATCH_THRESHOLD_NAME_ONLY = 0.7;

/**
 * Full identification flow:
 *   1. Ask GPT-5 mini to extract structured product info from the photo.
 *   2. Pull a shortlist of catalog candidates by type + brand trigram.
 *   3. Score against candidates; if best score clears threshold, link to existing.
 *   4. Otherwise create a draft product with the AI's best guess.
 *   5. Insert a product_images row with the photo URL.
 *   6. Return the product id + match info for the caller to redirect to.
 */
export async function identifyAndPersist(args: OrchestrateArgs): Promise<IdentifyOutcome> {
  const { supabase, userId, imagePublicUrl, storagePath, expectedType } = args;

  const extracted = await identifyProductFromImage({
    imageUrl: imagePublicUrl,
    expectedType,
    supabase,
    userId,
  });

  // Trust GPT-5's type call if it disagrees with the user — the photo is the
  // source of truth. The user-set toggle was a hint, not a constraint.
  const finalType = extracted.type;

  // Pull a candidate list. pg_trgm makes the brand-side filter cheap.
  const candidates = await fetchCandidates(supabase, finalType, extracted.brand);

  let matchedProductId: string | null = null;
  let matched = false;

  if (candidates.length > 0) {
    const best = pickBestMatch(candidates, { name: extracted.name, brand: extracted.brand });
    if (best) {
      const threshold =
        best.matched === "name+brand" ? MATCH_THRESHOLD_WITH_BRAND : MATCH_THRESHOLD_NAME_ONLY;
      if (best.score >= threshold) {
        matchedProductId = best.product.id;
        matched = true;
      }
    }
  }

  if (!matchedProductId) {
    const { data: created, error } = await supabase
      .from("products")
      .insert({
        type: finalType,
        name: extracted.name,
        brand: extracted.brand,
        specs: extracted.specs,
        status: "draft",
        source: "ai",
        created_by: userId,
      })
      .select("id")
      .single();

    if (error || !created) {
      throw new Error(`Failed to create draft product: ${error?.message ?? "no row returned"}`);
    }
    matchedProductId = created.id;
  }

  if (!matchedProductId) {
    throw new Error("Unreachable: product id should be set by this point.");
  }

  await supabase.from("product_images").insert({
    product_id: matchedProductId,
    image_url: storagePath,
    contributed_by: userId,
  });

  return {
    productId: matchedProductId,
    matched,
    confidence: extracted.confidence,
  };
}

async function fetchCandidates(
  supabase: SupabaseClient,
  type: ProductType,
  brand: string | null,
): Promise<CandidateProduct[]> {
  // Brand-side prefilter when we have one. Even a partial brand match cuts the
  // candidate set from thousands to dozens, making client-side scoring cheap.
  if (brand) {
    const { data } = await supabase
      .from("products")
      .select("id, name, brand")
      .eq("type", type)
      .ilike("brand", `%${brand.split(/\s+/)[0]}%`)
      .limit(50);
    if (data && data.length > 0) return data;
  }

  // Fallback: pull a small slice and let trigram scoring handle it.
  const { data } = await supabase
    .from("products")
    .select("id, name, brand")
    .eq("type", type)
    .eq("status", "confirmed")
    .limit(200);

  return data ?? [];
}
