import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateCost, logUsage } from "@/lib/usage/log";
import { getWheel, type ProductType, type WheelVector } from "@/lib/wheel";
import { MODELS, openai } from "./client";

type MapArgs = {
  type: ProductType;
  chips: string[];
  note: string | null;
  supabase: SupabaseClient;
  userId: string;
};

const SYSTEM_PROMPT = `You translate a club member's tasting impressions into a structured flavor profile.

You're given:
- The product type (cigar or bourbon).
- A list of "chips" — short flavor descriptors the member typed.
- An optional free-form note.
- The full flavor wheel for that product type (a list of leaf descriptors).

Your job: return a sparse map of { leaf_id: score 1-5 } reflecting how strongly each wheel leaf is present, based on the chips and the note.

Rules:
- The chips are the strongest signal. If a chip matches (directly or by clear synonym) a wheel leaf, score that leaf 4 or 5.
- The note can introduce additional leaves the chips didn't mention.
- Only include leaves with score >= 1. Leave the rest out entirely.
- Be conservative — better to omit than invent. The member's words win over your inference.
- A typical tasting yields 3-7 leaves. Going much beyond that is noise.
- Output JSON only, matching the supplied schema.
`;

/**
 * Build the response schema dynamically — every wheel leaf becomes an optional
 * integer property. OpenAI strict mode enforces enum/range, so the model can't
 * return leaves outside the wheel.
 */
function buildResponseSchema(type: ProductType) {
  const wheel = getWheel(type);
  const properties: Record<string, { type: string; minimum: number; maximum: number }> = {};
  for (const leaf of wheel.leaves) {
    properties[leaf.id] = { type: "integer", minimum: 1, maximum: 5 };
  }

  // Strict mode requires every property to be listed in `required`. We get
  // around this by wrapping the scores in an "intensities" object and adding
  // a `confidence` field; intensities itself stays loose via additionalProperties.
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

type RawResponse = {
  intensities: Record<string, number | null>;
  confidence: "high" | "medium" | "low";
};

/**
 * Convert the model's response (every leaf as a key, most nulled out) into
 * a sparse WheelVector: only leaves with score >= 1 survive.
 */
function sparsify(raw: RawResponse): WheelVector {
  const out: WheelVector = {};
  for (const [leafId, score] of Object.entries(raw.intensities)) {
    if (score === null || score === undefined) continue;
    const clamped = Math.max(1, Math.min(5, Math.round(score)));
    out[leafId] = clamped;
  }
  return out;
}

export type MapWheelResult = {
  vector: WheelVector;
  confidence: "high" | "medium" | "low";
};

export async function mapChipsAndNoteToWheel(args: MapArgs): Promise<MapWheelResult> {
  const { type, chips, note, supabase, userId } = args;
  const wheel = getWheel(type);

  // Slim wheel payload — just what the mapper needs.
  const wheelPayload = wheel.leaves.map((l) => ({
    id: l.id,
    label: l.label,
    category: l.category_id,
    synonyms: l.synonyms,
  }));

  const userMessage = JSON.stringify({
    product_type: type,
    chips,
    note: note ?? "",
    wheel: wheelPayload,
  });

  const completion = await openai().chat.completions.create({
    model: MODELS.mapper,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "wheel_mapping",
        schema: buildResponseSchema(type),
        strict: true,
      },
    },
  });

  const tokensIn = completion.usage?.prompt_tokens ?? 0;
  const tokensOut = completion.usage?.completion_tokens ?? 0;

  void logUsage(supabase, {
    user_id: userId,
    provider: "openai",
    model: MODELS.mapper,
    operation: "map-wheel",
    units_in: tokensIn,
    units_out: tokensOut,
    cost_usd: estimateCost(MODELS.mapper, tokensIn, tokensOut),
    metadata: { type, chip_count: chips.length, has_note: Boolean(note) },
  });

  const raw = completion.choices[0]?.message.content;
  if (!raw) throw new Error("Wheel mapper returned no content");

  const parsed = JSON.parse(raw) as RawResponse;
  return { vector: sparsify(parsed), confidence: parsed.confidence };
}

/**
 * Deterministic fallback used when the LLM call fails or while it's pending.
 * Maps chips directly onto wheel leaves via the synonym index and scores
 * matched chips at 4. Better-than-nothing, fully offline.
 */
export function fallbackMapFromChips(type: ProductType, chips: string[]): WheelVector {
  // Reusing buildSynonymIndex would create a cycle; inline a tiny matcher.
  const wheel = getWheel(type);
  const synonymToLeaf = new Map<string, string>();
  for (const leaf of wheel.leaves) {
    for (const key of [leaf.label, ...leaf.synonyms]) {
      const normalized = key.trim().toLowerCase();
      if (normalized && !synonymToLeaf.has(normalized)) {
        synonymToLeaf.set(normalized, leaf.id);
      }
    }
  }

  const out: WheelVector = {};
  for (const chip of chips) {
    const normalized = chip.trim().toLowerCase();
    const leafId = synonymToLeaf.get(normalized);
    if (leafId) out[leafId] = Math.max(out[leafId] ?? 0, 4);
  }
  return out;
}
