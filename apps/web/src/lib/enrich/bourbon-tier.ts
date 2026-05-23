/**
 * Bourbon allocation/rarity tier classification via gpt-5-nano.
 *
 * Separate from specs extraction — uses only product identity fields already
 * on the row, not review markdown.
 */

import type OpenAI from "openai";

export { tierToRarityLabel } from "@/lib/catalog/normalize-specs";

const MODEL = "gpt-5-nano";

export type BourbonTier = 1 | 2 | 3 | 4 | 5;
export type TierSource = "cobb" | "llm" | "manual";
export type RarityLabel = "common" | "uncommon" | "rare";

export type TierClassification = {
  tier: BourbonTier;
  rationale: string;
};

export type TierSkipReason = "tier_source_manual" | "tier_exists_no_source";

const TIER_SCHEMA = {
  type: "object",
  properties: {
    tier: { type: "integer", enum: [1, 2, 3, 4, 5] },
    rationale: {
      type: "string",
      description: "One sentence explaining the tier for audit",
    },
  },
  required: ["tier", "rationale"],
  additionalProperties: false,
} as const;

const SYSTEM = `You classify US bourbon/whiskey retail allocation rarity on a 1–5 scale for a private cigar club app.

Tier semantics:
- 1–2: Widely available shelf bourbon (Buffalo Trace, Maker's Mark, Evan Williams, standard Jim Beam, Wild Turkey 101, Knob Creek standard, Four Roses Yellow Label, etc.)
- 3: Seasonal, regional, or limited but findable without lottery (Blanton's, Eagle Rare, Weller Special Reserve / 107, Four Roses Single Barrel picks, most distillery-only releases that rotate)
- 4–5: Allocated, lottery, secondary-market, or discontinued gems (Pappy Van Winkle, BTAC, William Larue Weller, George T. Stagg, Elmer T. Lee at MSRP scarcity, Old Fitzgerald Bottled-in-Bond, highly allocated store picks)

Rules:
- Use your knowledge of US retail allocation reality for the named product.
- When uncertain, default to tier 3 — never guess tier 4 or 5.
- Generic NAS bourbon from a major distillery with no allocation reputation → tier 1–2.
- Rye and other American whiskeys use the same scale.
- Rationale: one concise sentence citing why (availability, allocation program, or uncertainty).`;

export type BourbonTierInput = {
  name: string;
  brand: string | null;
  specs: Record<string, unknown> | null;
};

function pickSpec(specs: Record<string, unknown> | null, key: string): unknown {
  if (!specs) return null;
  const v = specs[key];
  if (v === null || v === undefined || v === "") return null;
  return v;
}

export function buildTierClassifierPayload(product: BourbonTierInput): Record<string, unknown> {
  const specs = product.specs;
  return {
    name: product.name,
    brand: product.brand,
    distillery: pickSpec(specs, "distillery"),
    proof: pickSpec(specs, "proof"),
    age_years: pickSpec(specs, "age_years"),
    age_label: pickSpec(specs, "age_label"),
    mash_bill: pickSpec(specs, "mash_bill"),
    whiskey_type: pickSpec(specs, "whiskey_type"),
    expression_type: pickSpec(specs, "expression_type"),
    additional_notes: pickSpec(specs, "additional_notes"),
  };
}

function tierSource(specs: Record<string, unknown> | null): TierSource | null {
  const raw = specs?.tier_source;
  if (raw === "cobb" || raw === "llm" || raw === "manual") return raw;
  return null;
}

function existingTier(specs: Record<string, unknown> | null): number | null {
  const raw = specs?.tier;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 5) return null;
  return raw;
}

/** Pure skip gate — manual tiers never touched; orphan tiers need --force. Cobb rows run LLM. */
export function shouldSkipTierEnrichment(
  specs: Record<string, unknown> | null,
  force: boolean,
): TierSkipReason | null {
  const source = tierSource(specs);
  if (source === "manual") return "tier_source_manual";
  if (
    existingTier(specs) != null &&
    source == null &&
    specs?.in_cobb_collection !== true &&
    !force
  ) {
    return "tier_exists_no_source";
  }
  return null;
}

export function mergeTierIntoSpecs(
  existing: Record<string, unknown> | null,
  classification: TierClassification,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    tier: classification.tier,
    tier_source: "llm" as const,
    tier_rationale: classification.rationale,
  };
}

export async function classifyBourbonTier(
  client: OpenAI,
  product: BourbonTierInput,
): Promise<TierClassification & { tokensIn: number; tokensOut: number }> {
  const payload = buildTierClassifierPayload(product);

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify(payload) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "bourbon_tier",
        schema: TIER_SCHEMA,
        strict: true,
      },
    },
  });

  const raw = completion.choices[0]?.message.content;
  if (!raw) throw new Error("bourbon tier classifier returned no content");

  const parsed = JSON.parse(raw) as TierClassification;

  return {
    ...parsed,
    tokensIn: completion.usage?.prompt_tokens ?? 0,
    tokensOut: completion.usage?.completion_tokens ?? 0,
  };
}

export type TierEnrichResult = {
  productId: string;
  skipped: TierSkipReason | null;
  tier: BourbonTier | null;
  rationale: string | null;
  tokensIn: number;
  tokensOut: number;
  error: string | null;
};

export async function classifyAndMergeBourbonTier(
  product: {
    id: string;
    name: string;
    brand: string | null;
    specs: Record<string, unknown> | null;
  },
  client: OpenAI,
  opts: { dryRun?: boolean; force?: boolean } = {},
): Promise<TierEnrichResult & { mergedSpecs?: Record<string, unknown> }> {
  const out: TierEnrichResult = {
    productId: product.id,
    skipped: null,
    tier: null,
    rationale: null,
    tokensIn: 0,
    tokensOut: 0,
    error: null,
  };

  const skip = shouldSkipTierEnrichment(product.specs, opts.force ?? false);
  if (skip) {
    out.skipped = skip;
    return out;
  }

  try {
    const result = await classifyBourbonTier(client, product);
    out.tokensIn = result.tokensIn;
    out.tokensOut = result.tokensOut;
    out.tier = result.tier;
    out.rationale = result.rationale;

    const merged = mergeTierIntoSpecs(product.specs, result);
    if (!opts.dryRun) {
      return { ...out, mergedSpecs: merged };
    }
  } catch (err) {
    out.error = (err as Error).message;
  }

  return out;
}
