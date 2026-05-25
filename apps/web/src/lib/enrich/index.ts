/**
 * Catalog enrichment — single-product entry points used by both the CLI
 * batch scripts (scripts/seed/enrich-*.ts) and the capture server action
 * when a fresh draft needs to be filled in.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { ApifyClient } from "./apify-client";
import { type ApifyEnrichResult, type EnrichInput, enrichProductFromWeb } from "./apify-enrich";
import { productNeedsCatalogEnrichment } from "./needs-enrichment";
import { extractAndMergeSpecs, type SpecsEnrichResult } from "./specs-enrich";
import { extractAndMergeWheelVector, type WheelEnrichResult } from "./wheel-enrich";

export {
  type ApifyEnrichResult,
  buildSearchQuery,
  type EnrichInput,
  enrichProductFromWeb,
} from "./apify-enrich";
export { productNeedsCatalogEnrichment } from "./needs-enrichment";
export {
  extractAndMergeSpecs,
  type SpecsEnrichResult,
} from "./specs-enrich";
export {
  extractAndMergeWheelVector,
  type WheelEnrichResult,
} from "./wheel-enrich";

export type DraftEnrichResult = {
  productId: string;
  apify: ApifyEnrichResult;
  specs: SpecsEnrichResult | null;
  wheel: WheelEnrichResult | null;
};

async function countReviews(supabase: SupabaseClient, productId: string): Promise<number> {
  const { count, error } = await supabase
    .from("product_reviews")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if (error) throw new Error(`review count: ${error.message}`);
  return count ?? 0;
}

/**
 * One-call entry point for the capture flow. Runs the Apify web enrichment
 * (image + reviews) and then extracts specs + wheel_vector from those reviews.
 * Total wall time ~30-60s, dominated by Apify.
 */
export async function enrichDraftProduct(
  product: EnrichInput & {
    source?: string | null;
    specs: Record<string, unknown> | null;
    wheel_vector?: Record<string, number> | null;
  },
  supabase: SupabaseClient,
): Promise<DraftEnrichResult> {
  const apifyToken = process.env.APIFY_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!apifyToken) throw new Error("Missing APIFY_TOKEN");
  if (!openaiKey) throw new Error("Missing OPENAI_API_KEY");

  const apify = new ApifyClient(apifyToken);
  const openai = new OpenAI({ apiKey: openaiKey });

  const reviewCount = await countReviews(supabase, product.id);

  let apifyResult: ApifyEnrichResult = {
    productId: product.id,
    imageUrl: null,
    reviewsWritten: 0,
    llmFallbackUsed: false,
    mirrorError: null,
    apifyError: null,
  };

  if (reviewCount === 0) {
    apifyResult = await enrichProductFromWeb(product, { apify, openai, supabase });
  }

  const reviewsAfterApify =
    apifyResult.reviewsWritten > 0 ? apifyResult.reviewsWritten : reviewCount;

  let specsResult: SpecsEnrichResult | null = null;
  let wheelResult: WheelEnrichResult | null = null;

  if (reviewsAfterApify > 0) {
    specsResult = await extractAndMergeSpecs(product, { openai, supabase });

    const { data: fresh } = await supabase
      .from("products")
      .select("wheel_vector")
      .eq("id", product.id)
      .maybeSingle();

    if (!fresh?.wheel_vector || Object.keys(fresh.wheel_vector as object).length === 0) {
      wheelResult = await extractAndMergeWheelVector(
        {
          id: product.id,
          type: product.type,
          name: product.name,
          brand: product.brand,
          wheel_vector: (fresh?.wheel_vector ?? null) as Record<string, number> | null,
        },
        { openai, supabase },
      );
    }
  }

  return {
    productId: product.id,
    apify: apifyResult,
    specs: specsResult,
    wheel: wheelResult,
  };
}
