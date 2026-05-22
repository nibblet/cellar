/**
 * Per-product Apify enrichment.
 *
 * Same logic as the batch script's inner loop, refactored into a single-product
 * function so it can be called both from the CLI (scripts/seed/enrich-apify.ts)
 * and from the capture server action when a fresh draft needs enriching.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type OpenAI from "openai";
import type { ApifyClient, RagItem } from "./apify-client";
import { extractEnrichment } from "./apify-extractor";
import { pickImageWithLlm } from "./llm-image-picker";
import { MirrorError, mirrorImage } from "./storage-mirror";

export type EnrichInput = {
  id: string;
  type: "bourbon" | "cigar";
  name: string;
  brand: string | null;
  line: string | null;
};

export type ApifyEnrichResult = {
  productId: string;
  imageUrl: string | null;
  reviewsWritten: number;
  llmFallbackUsed: boolean;
  mirrorError: string | null;
  apifyError: string | null;
};

export type ApifyEnrichDeps = {
  apify: ApifyClient;
  openai: OpenAI;
  supabase: SupabaseClient;
};

/**
 * Build a search query from brand/line/name, deduping overlapping tokens.
 * Catalog rows often have brand="Punch Rare Corojo" and a name that repeats
 * it; the naive join doubles tokens and tanks search quality.
 */
export function buildSearchQuery(p: EnrichInput): string {
  const raw = [p.brand, p.line, p.name].filter(Boolean).join(" ");
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const tok of raw.split(/\s+/)) {
    const key = tok.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(tok);
  }
  const base = deduped.join(" ");
  return p.type === "cigar" ? `${base} cigar review` : `${base} bourbon review tasting notes`;
}

export type EnrichOptions = {
  /** How many search results to fetch from Apify (default 3). */
  maxResults?: number;
  /** Skip the image-mirror + DB writes; useful for dry-run inspection. */
  dryRun?: boolean;
};

/**
 * Run the full Apify enrichment pass on a single product. Writes:
 *  - products.image_url (mirrored Supabase Storage URL)
 *  - product_reviews (one row per result item)
 *
 * Never throws — collects errors into the result so the caller can log them
 * and decide whether to retry, fall back to a manual flow, or just continue.
 */
export async function enrichProductFromWeb(
  product: EnrichInput,
  deps: ApifyEnrichDeps,
  opts: EnrichOptions = {},
): Promise<ApifyEnrichResult> {
  const { apify, openai, supabase } = deps;
  const out: ApifyEnrichResult = {
    productId: product.id,
    imageUrl: null,
    reviewsWritten: 0,
    llmFallbackUsed: false,
    mirrorError: null,
    apifyError: null,
  };

  let items: RagItem[];
  try {
    items = await apify.ragWebBrowser({
      query: buildSearchQuery(product),
      maxResults: opts.maxResults ?? 3,
    });
  } catch (err) {
    out.apifyError = (err as Error).message;
    return out;
  }

  const enrichment = extractEnrichment(items, product);

  // LLM fallback for image pick when the heuristic scored nothing positive.
  if (!enrichment.imageUrl) {
    try {
      const llm = await pickImageWithLlm(openai, items, product);
      if (llm.imageUrl) {
        enrichment.imageUrl = llm.imageUrl;
        out.llmFallbackUsed = true;
      }
    } catch {
      // Falling through is fine — we'll just leave imageUrl null.
    }
  }

  if (opts.dryRun) {
    out.imageUrl = enrichment.imageUrl;
    return out;
  }

  if (enrichment.imageUrl) {
    try {
      const mirrored = await mirrorImage(supabase, {
        sourceUrl: enrichment.imageUrl,
        productId: product.id,
        productType: product.type,
      });
      await supabase
        .from("products")
        .update({ image_url: mirrored.publicUrl })
        .eq("id", product.id);
      out.imageUrl = mirrored.publicUrl;
    } catch (err) {
      out.mirrorError =
        err instanceof MirrorError ? `[${err.stage}] ${err.message}` : (err as Error).message;
    }
  }

  if (enrichment.reviews.length) {
    const rows = enrichment.reviews.map((r) => ({
      product_id: product.id,
      source: r.source,
      source_url: r.sourceUrl,
      reviewer: null,
      score: null,
      text: r.text,
    }));
    const { error: insErr } = await supabase.from("product_reviews").insert(rows);
    if (!insErr) out.reviewsWritten = rows.length;
  }

  return out;
}
