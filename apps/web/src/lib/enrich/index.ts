/**
 * Catalog enrichment — single-product entry points used by both the CLI
 * batch scripts (scripts/seed/enrich-*.ts) and the capture server action
 * when a fresh draft needs to be filled in.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { ApifyClient } from "./apify-client";
import { type ApifyEnrichResult, type EnrichInput, enrichProductFromWeb } from "./apify-enrich";
import { extractAndMergeSpecs, type SpecsEnrichResult } from "./specs-enrich";

export {
  type ApifyEnrichResult,
  buildSearchQuery,
  type EnrichInput,
  enrichProductFromWeb,
} from "./apify-enrich";
export {
  extractAndMergeSpecs,
  type SpecsEnrichResult,
} from "./specs-enrich";

export type DraftEnrichResult = {
  productId: string;
  apify: ApifyEnrichResult;
  specs: SpecsEnrichResult | null;
};

/**
 * One-call entry point for the capture flow. Runs the Apify web enrichment
 * (image + reviews) and then immediately extracts structured specs from
 * those reviews. Total wall time ~30-60s, dominated by Apify.
 *
 * Lazily constructs the OpenAI and Apify clients from process.env so callers
 * (server actions, scripts) don't have to plumb them through.
 */
export async function enrichDraftProduct(
  product: EnrichInput & { specs: Record<string, unknown> | null },
  supabase: SupabaseClient,
): Promise<DraftEnrichResult> {
  const apifyToken = process.env.APIFY_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!apifyToken) throw new Error("Missing APIFY_TOKEN");
  if (!openaiKey) throw new Error("Missing OPENAI_API_KEY");

  const apify = new ApifyClient(apifyToken);
  const openai = new OpenAI({ apiKey: openaiKey });

  const apifyResult = await enrichProductFromWeb(product, {
    apify,
    openai,
    supabase,
  });

  // Only run specs extraction if we actually wrote reviews — otherwise
  // there's nothing to extract from.
  let specsResult: SpecsEnrichResult | null = null;
  if (apifyResult.reviewsWritten > 0) {
    specsResult = await extractAndMergeSpecs(product, { openai, supabase });
  }

  return {
    productId: product.id,
    apify: apifyResult,
    specs: specsResult,
  };
}
