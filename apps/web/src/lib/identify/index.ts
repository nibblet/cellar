import type { SupabaseClient } from "@supabase/supabase-js";
import { identifyProductFromImage } from "@/lib/openai/identify";
import type { ProductType } from "@/lib/wheel";
import { createDraftProduct } from "./draft";
import { matchExtractedToCatalog } from "./match";

export { createDraftProduct } from "./draft";
export type { CatalogMatchResult } from "./match";
export { matchExtractedToCatalog } from "./match";
export type { PairIdentifyHalf, PairIdentifyResult } from "./pair";
export { identifyPairFromImage } from "./pair";

export type IdentifyOutcome = {
  productId: string;
  matched: boolean;
  confidence: "high" | "medium" | "low";
  /** True when we created a fresh draft and the caller should kick off the
   *  async catalog enrichment pass (POST /api/enrich-draft). The capture
   *  flow uses this to decide whether to fire the enrichment fetch. */
  needsEnrichment: boolean;
  /** Vision-extracted release variant (bourbon). Null when unreadable or cigar. */
  releaseLabel: string | null;
};

type OrchestrateArgs = {
  supabase: SupabaseClient;
  userId: string;
  imagePublicUrl: string;
  storagePath: string;
  expectedType: ProductType;
};

/**
 * Photo-identify orchestration:
 *   1. Ask GPT-5 mini to extract structured product info from the photo.
 *   2. Pull a shortlist of catalog candidates by type + brand prefilter.
 *   3. Score against candidates; if best score clears threshold, link to it.
 *   4. Otherwise create a draft product with the AI's best guess.
 *   5. Insert a product_images row with the photo URL.
 *
 * Catalog enrichment of fresh drafts runs ASYNCHRONOUSLY in a follow-up
 * /api/enrich-draft fetch fired from the product detail page. We deliberately
 * don't enrich inline here because the Apify pass takes 30-60s, which would
 * push this server action past Vercel Hobby's 60s function timeout.
 */
export async function identifyAndPersist(args: OrchestrateArgs): Promise<IdentifyOutcome> {
  const { supabase, userId, imagePublicUrl, storagePath, expectedType } = args;

  const extracted = await identifyProductFromImage({
    imageUrl: imagePublicUrl,
    expectedType,
    supabase,
    userId,
  });

  const finalType = expectedType;
  if (extracted.type !== expectedType) {
    console.warn(
      `[identifyAndPersist] vision type "${extracted.type}" disagrees with capture toggle "${expectedType}" — keeping toggle`,
    );
  }

  const match = await matchExtractedToCatalog(supabase, finalType, extracted);

  let matchedProductId = match.productId;
  const matched = match.matched;
  let needsEnrichment = false;

  if (!matchedProductId) {
    matchedProductId = await createDraftProduct(supabase, userId, finalType, extracted);
    needsEnrichment = true;
  }

  await supabase.from("product_images").insert({
    product_id: matchedProductId,
    image_url: storagePath,
    contributed_by: userId,
  });

  return {
    productId: matchedProductId,
    matched,
    confidence: match.confidence,
    needsEnrichment,
    releaseLabel: match.releaseLabel,
  };
}
