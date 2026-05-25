/**
 * Extract a baseline wheel_vector from product_reviews via gpt-5-nano.
 * Complements specs extraction — gives pairing engine + flavor profile something
 * to work with before any member tastings land.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type OpenAI from "openai";
import { getWheel, type ProductType, type WheelVector } from "@/lib/wheel";
import { rollUpTraits } from "@/lib/wheel/traits";

const MODEL = "gpt-5-nano";
const WHEEL_VERSION = "0.1";

const SYSTEM = `You translate cigar or bourbon review prose into a structured flavor profile.

You're given review text and the full flavor wheel for that product type.

Return a sparse map of { leaf_id: score 1-5 } for flavors explicitly described in the reviews.

Rules:
- Only score leaves with clear support in the text. Do not infer from the product name alone.
- Typical output: 4-10 leaves. Going much beyond that is noise.
- Be conservative — omit rather than guess.
- Output JSON only, matching the supplied schema.`;

export type WheelEnrichResult = {
  productId: string;
  leavesFilled: number;
  tokensIn: number;
  tokensOut: number;
  error: string | null;
};

export type WheelEnrichDeps = {
  openai: OpenAI;
  supabase: SupabaseClient;
};

function buildResponseSchema(type: ProductType) {
  const wheel = getWheel(type);
  const properties: Record<string, { type: string; minimum: number; maximum: number }> = {};
  for (const leaf of wheel.leaves) {
    properties[leaf.id] = { type: "integer", minimum: 1, maximum: 5 };
  }

  return {
    type: "object",
    properties: {
      intensities: {
        type: "object",
        properties,
        additionalProperties: false,
        required: Object.keys(properties),
      },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
    },
    required: ["intensities", "confidence"],
    additionalProperties: false,
  } as const;
}

function sparsify(intensities: Record<string, number | null>): WheelVector {
  const out: WheelVector = {};
  for (const [leafId, score] of Object.entries(intensities)) {
    if (score === null || score === undefined) continue;
    out[leafId] = Math.max(1, Math.min(5, Math.round(score)));
  }
  return out;
}

function joinReviews(reviews: Array<{ source: string; text: string }>): string {
  const sorted = [...reviews].sort((a, b) => b.text.length - a.text.length);
  return sorted
    .slice(0, 2)
    .map((r) => `=== ${r.source} ===\n${r.text}`)
    .join("\n\n");
}

function mergeWheelVectors(existing: WheelVector | null, extracted: WheelVector): WheelVector {
  const merged: WheelVector = { ...(existing ?? {}) };
  for (const [leaf, score] of Object.entries(extracted)) {
    merged[leaf] = Math.max(merged[leaf] ?? 0, score);
  }
  return merged;
}

export async function extractAndMergeWheelVector(
  product: {
    id: string;
    type: ProductType;
    name: string;
    brand: string | null;
    wheel_vector: WheelVector | null;
  },
  deps: WheelEnrichDeps,
  opts: { dryRun?: boolean } = {},
): Promise<WheelEnrichResult> {
  const { openai, supabase } = deps;
  const out: WheelEnrichResult = {
    productId: product.id,
    leavesFilled: 0,
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

  const wheel = getWheel(product.type);
  const wheelPayload = wheel.leaves.map((l) => ({
    id: l.id,
    label: l.label,
    category: l.category_id,
    synonyms: l.synonyms,
  }));

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            product_type: product.type,
            brand: product.brand,
            name: product.name,
            review_text: reviewText.slice(0, 12000),
            wheel: wheelPayload,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "review_wheel_mapping",
          schema: buildResponseSchema(product.type),
          strict: true,
        },
      },
    });

    out.tokensIn = completion.usage?.prompt_tokens ?? 0;
    out.tokensOut = completion.usage?.completion_tokens ?? 0;

    const raw = completion.choices[0]?.message.content;
    if (!raw) throw new Error("wheel extractor returned no content");

    const parsed = JSON.parse(raw) as {
      intensities: Record<string, number | null>;
    };
    const extracted = sparsify(parsed.intensities);
    out.leavesFilled = Object.keys(extracted).length;
    if (out.leavesFilled === 0) return out;

    const merged = mergeWheelVectors(product.wheel_vector, extracted);
    const traits = rollUpTraits(product.type, merged);

    if (!opts.dryRun) {
      const { error: updErr } = await supabase
        .from("products")
        .update({
          wheel_vector: merged,
          trait_vector: traits,
          wheel_version: WHEEL_VERSION,
        })
        .eq("id", product.id);
      if (updErr) out.error = `update: ${updErr.message}`;
    }
  } catch (err) {
    out.error = (err as Error).message;
  }

  return out;
}
