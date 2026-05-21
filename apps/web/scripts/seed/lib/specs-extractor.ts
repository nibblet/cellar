/**
 * gpt-5-nano extractor that turns review markdown (from product_reviews.text)
 * into structured specs we can merge into products.specs.
 *
 * Type-aware schemas — cigars and bourbons have very different fields. Every
 * field is nullable; the model is told to return null when not stated.
 * The caller is responsible for merging into existing specs.
 */

import OpenAI from "openai";

const MODEL = "gpt-5-nano";

const SYSTEM = `You extract structured product specs from cigar and bourbon review articles.

Rules:
- Use ONLY facts explicitly stated in the supplied text.
- Return null for any field not stated. Do NOT guess from the product name.
- For numeric fields, parse the number out of phrases like "6 inches" or "47.5% ABV".
- For 'score', return the single overall numeric rating the reviewer gives the product (typically 0-100). If multiple reviewers/sources score, return the average rounded to integer. Return null if no numeric score is given.
- For cigar 'strength' and 'body', use one of: mild, mild-medium, medium, medium-full, full.
- Be conservative — a missing value is far better than a wrong one.`;

export const CIGAR_SCHEMA = {
  type: "object",
  properties: {
    vitola: { type: ["string", "null"] },
    length_inches: { type: ["number", "null"] },
    ring_gauge: { type: ["integer", "null"] },
    wrapper: { type: ["string", "null"] },
    wrapper_color: { type: ["string", "null"] },
    binder: { type: ["string", "null"] },
    filler: { type: ["string", "null"] },
    country: { type: ["string", "null"] },
    factory: { type: ["string", "null"] },
    strength: {
      type: ["string", "null"],
      enum: ["mild", "mild-medium", "medium", "medium-full", "full", null],
    },
    body: {
      type: ["string", "null"],
      enum: ["mild", "mild-medium", "medium", "medium-full", "full", null],
    },
    msrp_usd: { type: ["number", "null"] },
    release_date: { type: ["string", "null"], description: "ISO date or year if only year known" },
    score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
  },
  required: [
    "vitola",
    "length_inches",
    "ring_gauge",
    "wrapper",
    "wrapper_color",
    "binder",
    "filler",
    "country",
    "factory",
    "strength",
    "body",
    "msrp_usd",
    "release_date",
    "score",
  ],
  additionalProperties: false,
} as const;

export const BOURBON_SCHEMA = {
  type: "object",
  properties: {
    abv: { type: ["number", "null"] },
    proof: { type: ["number", "null"] },
    age_years: { type: ["number", "null"] },
    mash_bill: { type: ["string", "null"] },
    distillery: { type: ["string", "null"] },
    expression_type: {
      type: ["string", "null"],
      description:
        "e.g. 'Single Barrel', 'Bottled-in-Bond', 'Small Batch', 'Cask Strength'",
    },
    msrp_usd: { type: ["number", "null"] },
    release_year: { type: ["integer", "null"] },
    score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
  },
  required: [
    "abv",
    "proof",
    "age_years",
    "mash_bill",
    "distillery",
    "expression_type",
    "msrp_usd",
    "release_year",
    "score",
  ],
  additionalProperties: false,
} as const;

export type CigarSpecs = {
  vitola: string | null;
  length_inches: number | null;
  ring_gauge: number | null;
  wrapper: string | null;
  wrapper_color: string | null;
  binder: string | null;
  filler: string | null;
  country: string | null;
  factory: string | null;
  strength: string | null;
  body: string | null;
  msrp_usd: number | null;
  release_date: string | null;
  score: number | null;
};

export type BourbonSpecs = {
  abv: number | null;
  proof: number | null;
  age_years: number | null;
  mash_bill: string | null;
  distillery: string | null;
  expression_type: string | null;
  msrp_usd: number | null;
  release_year: number | null;
  score: number | null;
};

export type ExtractResult<T> = {
  specs: T;
  tokensIn: number;
  tokensOut: number;
};

export async function extractSpecs<T extends CigarSpecs | BourbonSpecs>(
  client: OpenAI,
  args: {
    productType: "bourbon" | "cigar";
    productName: string;
    brand: string | null;
    reviewText: string;
  },
): Promise<ExtractResult<T>> {
  const schema = args.productType === "cigar" ? CIGAR_SCHEMA : BOURBON_SCHEMA;

  // Cap input to keep token cost predictable. The structured spec block on
  // halfwheel/CA always appears in the first ~6k chars; beyond that is
  // narrative we don't need for extraction.
  const trimmed = args.reviewText.slice(0, 12000);

  const userMessage = JSON.stringify({
    product_type: args.productType,
    brand: args.brand,
    name: args.productName,
    review_text: trimmed,
  });

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userMessage },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "product_specs",
        schema,
        strict: true,
      },
    },
  });

  const raw = completion.choices[0]?.message.content;
  if (!raw) throw new Error("specs extractor returned no content");

  return {
    specs: JSON.parse(raw) as T,
    tokensIn: completion.usage?.prompt_tokens ?? 0,
    tokensOut: completion.usage?.completion_tokens ?? 0,
  };
}
