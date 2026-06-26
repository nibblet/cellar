/**
 * Per-product catalog enrichment via OpenAI web search + structured output.
 *
 * One Responses API call returns image URL, specs, and wheel flavors — no
 * product_reviews rows, no follow-up nano extraction passes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type OpenAI from "openai";
import type { Response } from "openai/resources/responses/responses";
import { MODELS } from "@/lib/openai/client";
import { estimateCost, logUsage } from "@/lib/usage/log";
import { getWheel, type ProductType, type WheelVector } from "@/lib/wheel";
import { rollUpTraits } from "@/lib/wheel/traits";
import { MirrorError, mirrorImage } from "./storage-mirror";
import { buildWebEnrichSchema, wheelLeafIdsForPrompt } from "./web-enrich-schema";

const WHEEL_VERSION = "0.1";
const SEARCH_TIMEOUT_MS = 50_000;

export type EnrichInput = {
  id: string;
  type: "bourbon" | "cigar";
  name: string;
  brand: string | null;
  line: string | null;
};

export type WebEnrichResult = {
  productId: string;
  imageUrl: string | null;
  specsFieldsFilled: string[];
  wheelLeavesFilled: number;
  mirrorError: string | null;
  searchError: string | null;
  tokensIn: number;
  tokensOut: number;
};

export type WebEnrichDeps = {
  openai: OpenAI;
  supabase: SupabaseClient;
  userId?: string | null;
};

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
  dryRun?: boolean;
  imageOnly?: boolean;
};

type ParsedImageOnly = {
  image_url: string | null;
  source_urls: string[];
};

type ParsedFull = ParsedImageOnly & {
  specs: Record<string, unknown>;
  flavors: Array<{ leaf_id: string; score: number }>;
};

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

function flavorsToWheelVector(
  flavors: Array<{ leaf_id: string; score: number }>,
  type: ProductType,
): WheelVector {
  const valid = new Set(getWheel(type).leaves.map((l) => l.id));
  const out: WheelVector = {};
  for (const f of flavors) {
    if (!valid.has(f.leaf_id)) continue;
    out[f.leaf_id] = Math.max(1, Math.min(5, Math.round(f.score)));
  }
  return out;
}

function mergeWheelVectors(existing: WheelVector | null, extracted: WheelVector): WheelVector {
  const merged: WheelVector = { ...(existing ?? {}) };
  for (const [leaf, score] of Object.entries(extracted)) {
    merged[leaf] = Math.max(merged[leaf] ?? 0, score);
  }
  return merged;
}

function collectSearchSourceUrls(output: Response["output"]): Set<string> {
  const urls = new Set<string>();
  for (const item of output) {
    if (item.type !== "web_search_call") continue;
    const action = item.action;
    if (action.type !== "search") continue;
    for (const source of action.sources ?? []) {
      if (source.type === "url" && source.url) urls.add(source.url);
    }
  }
  return urls;
}

function buildSystemPrompt(type: ProductType, imageOnly: boolean): string {
  if (imageOnly) {
    return `Search the web for a clear hero product photo of this ${type}.
Return a direct image URL (jpeg/png/webp) of the bottle or cigar — not a site logo, avatar, or ad.
Prefer manufacturer, retailer, or major review-site product shots. Return null if none is acceptable.`;
  }

  const leafIds = wheelLeafIdsForPrompt(type).join(", ");
  return `Search the web for catalog facts about this ${type} from reputable review and manufacturer sources.

Return structured data only — no prose reviews.

Rules:
- specs: only facts explicitly stated in search results; null when not found. Do not guess from the product name.
- flavors: use wheel leaf_id values with scores 1-5 only for flavors clearly described in reviews. Typical output: 4-10 leaves.
- image_url: direct URL to a clear hero product photo (bottle/cigar), not a logo. null if none found.
- source_urls: URLs you relied on for specs and flavors.

Valid flavor leaf_ids: ${leafIds}`;
}

export async function enrichProductFromWeb(
  product: EnrichInput & {
    specs?: Record<string, unknown> | null;
    wheel_vector?: WheelVector | null;
  },
  deps: WebEnrichDeps,
  opts: EnrichOptions = {},
): Promise<WebEnrichResult> {
  const { openai, supabase, userId = null } = deps;
  const imageOnly = opts.imageOnly === true;
  const out: WebEnrichResult = {
    productId: product.id,
    imageUrl: null,
    specsFieldsFilled: [],
    wheelLeavesFilled: 0,
    mirrorError: null,
    searchError: null,
    tokensIn: 0,
    tokensOut: 0,
  };

  const userMessage = [
    `PRODUCT: ${product.brand ? `${product.brand} — ` : ""}${product.name}`,
    `TYPE: ${product.type}`,
    `SEARCH: ${buildSearchQuery(product)}`,
  ].join("\n");

  let parsed: ParsedImageOnly | ParsedFull;
  let sourceUrls: Set<string>;

  try {
    const response = await openai.responses.parse(
      {
        model: MODELS.vision,
        tools: [{ type: "web_search", search_context_size: "medium" }],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        input: [
          { role: "system", content: buildSystemPrompt(product.type, imageOnly) },
          { role: "user", content: userMessage },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "catalog_enrichment",
            strict: true,
            schema: buildWebEnrichSchema(product.type, imageOnly),
          },
        },
      },
      { signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) },
    );

    out.tokensIn = response.usage?.input_tokens ?? 0;
    out.tokensOut = response.usage?.output_tokens ?? 0;
    sourceUrls = collectSearchSourceUrls(response.output);

    void logUsage(supabase, {
      user_id: userId,
      provider: "openai",
      model: MODELS.vision,
      operation: imageOnly ? "web-enrich-image" : "web-enrich",
      units_in: out.tokensIn,
      units_out: out.tokensOut,
      cost_usd: estimateCost(MODELS.vision, out.tokensIn, out.tokensOut),
      metadata: { product_id: product.id, image_only: imageOnly },
    });

    if (!response.output_parsed) {
      out.searchError = "web search returned no structured output";
      return out;
    }
    parsed = response.output_parsed as ParsedImageOnly | ParsedFull;
  } catch (err) {
    out.searchError = (err as Error).message;
    return out;
  }

  const imageUrl = normalizeImageUrl(parsed.image_url);
  out.imageUrl = imageUrl;

  if (opts.dryRun) return out;

  if (imageUrl) {
    try {
      const mirrored = await mirrorImage(supabase, {
        sourceUrl: imageUrl,
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

  if (imageOnly) return out;

  const full = parsed as ParsedFull;
  const { merged: mergedSpecs, filled } = mergeSpecs(product.specs ?? null, full.specs);
  out.specsFieldsFilled = filled;

  const extractedWheel = flavorsToWheelVector(full.flavors ?? [], product.type);
  out.wheelLeavesFilled = Object.keys(extractedWheel).length;
  const mergedWheel = mergeWheelVectors(product.wheel_vector ?? null, extractedWheel);
  const traits = rollUpTraits(product.type, mergedWheel);

  const specsPayload: Record<string, unknown> = {
    ...mergedSpecs,
    web_enriched_at: new Date().toISOString(),
    enrichment_source: "openai_web",
    enrichment_source_urls: [...new Set([...parsed.source_urls, ...sourceUrls])].slice(0, 10),
  };

  const update: Record<string, unknown> = { specs: specsPayload };
  if (out.wheelLeavesFilled > 0) {
    update.wheel_vector = mergedWheel;
    update.trait_vector = traits;
    update.wheel_version = WHEEL_VERSION;
  }

  const { error: updErr } = await supabase.from("products").update(update).eq("id", product.id);
  if (updErr) {
    out.searchError = `db update: ${updErr.message}`;
  }

  return out;
}

const IMAGE_URL_BLOCKLIST = ["logo", "avatar", "gravatar", "icon", "banner", "ads", "subscribe"];

function normalizeImageUrl(candidate: string | null | undefined): string | null {
  if (!candidate?.trim()) return null;
  try {
    const trimmed = candidate.trim();
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const lower = trimmed.toLowerCase();
    if (IMAGE_URL_BLOCKLIST.some((b) => lower.includes(b))) return null;
    return trimmed;
  } catch {
    return null;
  }
}
