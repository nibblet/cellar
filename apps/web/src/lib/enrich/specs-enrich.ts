/**
 * Per-product specs extraction.
 *
 * Reads product_reviews.text for a single product, calls gpt-5-nano with the
 * type-aware schema, and merges the extracted facts into products.specs.
 * Designed to compose with enrichProductFromWeb — call this after the Apify
 * pass writes reviews and you'll patch specs from the same content.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type OpenAI from "openai";
import { type BourbonSpecs, type CigarSpecs, extractSpecs } from "./specs-extractor";

export type SpecsEnrichResult = {
  productId: string;
  fieldsExtracted: number;
  fieldsFilled: string[];
  tokensIn: number;
  tokensOut: number;
  error: string | null;
};

export type SpecsEnrichDeps = {
  openai: OpenAI;
  supabase: SupabaseClient;
};

/**
 * Concatenate the two longest review bodies. Halfwheel and Cigar Aficionado
 * carry the structured spec block in the body; shorter sources rarely add
 * new facts and just spend tokens.
 */
function joinReviews(reviews: Array<{ source: string; text: string }>): string {
  const sorted = [...reviews].sort((a, b) => b.text.length - a.text.length);
  return sorted
    .slice(0, 2)
    .map((r) => `=== ${r.source} ===\n${r.text}`)
    .join("\n\n");
}

/**
 * Non-destructive merge: existing non-null fields in specs win, and we never
 * overwrite a real fact with a null from extraction.
 */
function mergeSpecs(
  existing: Record<string, unknown> | null,
  extracted: Record<string, unknown>,
): { merged: Record<string, unknown>; filled: string[] } {
  const merged: Record<string, unknown> = { ...(existing ?? {}) };
  const filled: string[] = [];
  for (const [k, v] of Object.entries(extracted)) {
    if (v === null || v === undefined || v === "") continue;
    const cur = merged[k];
    if (cur === null || cur === undefined || cur === "") {
      merged[k] = v;
      filled.push(k);
    }
  }
  return { merged, filled };
}

export type SpecsExtractOptions = {
  dryRun?: boolean;
};

export async function extractAndMergeSpecs(
  product: {
    id: string;
    type: "bourbon" | "cigar";
    name: string;
    brand: string | null;
    specs: Record<string, unknown> | null;
  },
  deps: SpecsEnrichDeps,
  opts: SpecsExtractOptions = {},
): Promise<SpecsEnrichResult> {
  const { openai, supabase } = deps;
  const out: SpecsEnrichResult = {
    productId: product.id,
    fieldsExtracted: 0,
    fieldsFilled: [],
    tokensIn: 0,
    tokensOut: 0,
    error: null,
  };

  const { data: reviews, error: reviewsErr } = await supabase
    .from("product_reviews")
    .select("source, text")
    .eq("product_id", product.id);

  if (reviewsErr) {
    out.error = `reviews fetch: ${reviewsErr.message}`;
    return out;
  }
  if (!reviews?.length) {
    out.error = "no reviews to extract from";
    return out;
  }

  const reviewText = joinReviews(reviews);
  if (!reviewText.trim()) {
    out.error = "review text empty";
    return out;
  }

  try {
    const extraction =
      product.type === "cigar"
        ? await extractSpecs<CigarSpecs>(openai, {
            productType: "cigar",
            productName: product.name,
            brand: product.brand,
            reviewText,
          })
        : await extractSpecs<BourbonSpecs>(openai, {
            productType: "bourbon",
            productName: product.name,
            brand: product.brand,
            reviewText,
          });

    out.tokensIn = extraction.tokensIn;
    out.tokensOut = extraction.tokensOut;
    out.fieldsExtracted = Object.values(extraction.specs).filter((v) => v !== null).length;

    const { merged, filled } = mergeSpecs(
      product.specs,
      extraction.specs as Record<string, unknown>,
    );
    out.fieldsFilled = filled;

    if (!opts.dryRun) {
      const { error: updErr } = await supabase
        .from("products")
        .update({ specs: merged })
        .eq("id", product.id);
      if (updErr) out.error = `update: ${updErr.message}`;
    }
  } catch (err) {
    out.error = (err as Error).message;
  }

  return out;
}
