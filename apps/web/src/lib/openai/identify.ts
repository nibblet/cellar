import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateCost, logUsage } from "@/lib/usage/log";
import type { ProductType } from "@/lib/wheel";
import { MODELS, openai } from "./client";

export type IdentifiedProduct = {
  type: ProductType;
  name: string;
  brand: string | null;
  specs: Record<string, string | number | null>;
  confidence: "high" | "medium" | "low";
  notes: string | null;
};

type IdentifyArgs = {
  imageUrl: string;
  expectedType: ProductType;
  supabase: SupabaseClient;
  userId: string;
};

const SYSTEM_PROMPT = `You are a cigar and bourbon expert helping members of a private tasting club identify products from photos.

Your job: extract structured product information from the image. The user has indicated whether they're holding a cigar or a bourbon. Identify the specific product as precisely as the photo allows.

For cigars, look at:
- The band (the paper ring around the cigar) — this is where brand and line are printed
- The wrapper color (claro/colorado/maduro/oscuro) — visible from the leaf itself
- Country of origin if printed
- Vitola (size/shape) if printed

For bourbons, look at:
- The bottle label — distillery, brand, expression, age statement, proof/ABV
- Front label is primary; back label has mash bill sometimes

Be conservative. If you can't read the band/label clearly, say so via low confidence.
The member's cigar/bourbon toggle is authoritative — always return that type. If the
photo looks like the other category, mention it in notes instead of changing type.
`;

const cigarSpecsSchema = {
  type: "object",
  properties: {
    wrapper_color: {
      type: ["string", "null"],
      description: "claro, colorado, maduro, oscuro, etc.",
    },
    country: { type: ["string", "null"], description: "country of origin if visible" },
    vitola: { type: ["string", "null"], description: "size/shape name if visible" },
    strength: { type: ["string", "null"], description: "mild, medium, full if marked" },
  },
  required: ["wrapper_color", "country", "vitola", "strength"],
  additionalProperties: false,
} as const;

const bourbonSpecsSchema = {
  type: "object",
  properties: {
    distillery: { type: ["string", "null"], description: "distillery if labeled" },
    age_years: { type: ["number", "null"], description: "age statement in years" },
    proof: { type: ["number", "null"], description: "US proof (= 2 * ABV)" },
    abv: { type: ["number", "null"], description: "alcohol by volume %" },
    mash_bill: { type: ["string", "null"], description: "grain percentages if labeled" },
  },
  required: ["distillery", "age_years", "proof", "abv", "mash_bill"],
  additionalProperties: false,
} as const;

function buildSchema(type: ProductType) {
  return {
    type: "object",
    properties: {
      type: { type: "string", enum: [type] },
      name: {
        type: "string",
        description:
          "Full product name as printed (e.g., 'Padrón 1964 Anniversary Maduro Exclusivo')",
      },
      brand: {
        type: ["string", "null"],
        description: "Brand or maker (e.g., 'Padrón', 'Buffalo Trace')",
      },
      specs: type === "cigar" ? cigarSpecsSchema : bourbonSpecsSchema,
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      notes: {
        type: ["string", "null"],
        description: "Anything unusual or worth flagging — e.g., 'band partially obscured'",
      },
    },
    required: ["type", "name", "brand", "specs", "confidence", "notes"],
    additionalProperties: false,
  } as const;
}

/**
 * Identify a product from a photo URL. Returns structured fields plus a
 * confidence rating. Caller is responsible for fuzzy-matching the returned
 * name against the canonical catalog and either linking or creating a draft.
 */
export async function identifyProductFromImage(args: IdentifyArgs): Promise<IdentifiedProduct> {
  const { imageUrl, expectedType, supabase, userId } = args;
  const schema = buildSchema(expectedType);

  const completion = await openai().chat.completions.create({
    model: MODELS.vision,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `The user says this is a ${expectedType}. Identify the product.`,
          },
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "identified_product", schema, strict: true },
    },
  });

  const tokensIn = completion.usage?.prompt_tokens ?? 0;
  const tokensOut = completion.usage?.completion_tokens ?? 0;

  void logUsage(supabase, {
    user_id: userId,
    provider: "openai",
    model: MODELS.vision,
    operation: "identify-product",
    units_in: tokensIn,
    units_out: tokensOut,
    cost_usd: estimateCost(MODELS.vision, tokensIn, tokensOut),
    metadata: { expectedType },
  });

  const raw = completion.choices[0]?.message.content;
  if (!raw) throw new Error("OpenAI returned no content");

  const parsed = JSON.parse(raw) as IdentifiedProduct;
  return parsed;
}
