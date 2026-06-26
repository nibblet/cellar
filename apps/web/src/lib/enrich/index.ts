/**
 * Catalog enrichment — single-product entry points used by both the CLI
 * batch scripts (scripts/seed/enrich-*.ts) and the capture server action
 * when a fresh draft needs to be filled in.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { productNeedsCatalogEnrichment } from "./needs-enrichment";
import { type EnrichInput, enrichProductFromWeb, type WebEnrichResult } from "./web-enrich";

export { isCatalogWebEnriched, productNeedsCatalogEnrichment } from "./needs-enrichment";
export {
  extractAndMergeSpecs,
  type SpecsEnrichResult,
} from "./specs-enrich";
export {
  buildSearchQuery,
  type EnrichInput,
  enrichProductFromWeb,
  type WebEnrichResult,
} from "./web-enrich";
export {
  extractAndMergeWheelVector,
  type WheelEnrichResult,
} from "./wheel-enrich";

export type DraftEnrichResult = {
  productId: string;
  web: WebEnrichResult;
};

/**
 * One-call entry point for the capture flow. Runs OpenAI web search enrichment
 * (image + specs + wheel in a single structured response).
 */
export async function enrichDraftProduct(
  product: EnrichInput & {
    source?: string | null;
    specs: Record<string, unknown> | null;
    wheel_vector?: Record<string, number> | null;
  },
  supabase: SupabaseClient,
  userId?: string | null,
  opts: { force?: boolean } = {},
): Promise<DraftEnrichResult> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("Missing OPENAI_API_KEY");

  const openai = new OpenAI({ apiKey: openaiKey });

  const reviewCount = await countLegacyReviews(supabase, product.id);
  const needsEnrichment = productNeedsCatalogEnrichment({
    productType: product.type,
    source: product.source ?? null,
    specs: product.specs,
    reviewCount,
    hasWheelVector: product.wheel_vector != null && Object.keys(product.wheel_vector).length > 0,
  });

  let webResult: WebEnrichResult = {
    productId: product.id,
    imageUrl: null,
    specsFieldsFilled: [],
    wheelLeavesFilled: 0,
    mirrorError: null,
    searchError: null,
    tokensIn: 0,
    tokensOut: 0,
  };

  if (opts.force || needsEnrichment) {
    webResult = await enrichProductFromWeb(product, { openai, supabase, userId });
  }

  return {
    productId: product.id,
    web: webResult,
  };
}

async function countLegacyReviews(supabase: SupabaseClient, productId: string): Promise<number> {
  const { count, error } = await supabase
    .from("product_reviews")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if (error) throw new Error(`review count: ${error.message}`);
  return count ?? 0;
}
