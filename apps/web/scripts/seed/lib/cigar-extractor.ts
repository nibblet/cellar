import OpenAI from "openai";

const MODEL = "gpt-5-nano";

const SYSTEM_PROMPT = `You extract structured cigar product data from review titles and excerpts published by Halfwheel.com.

Given the title and a short excerpt of the review, return:
- product_name: the full canonical name as it appears (e.g., "Padrón 1964 Anniversary Maduro Exclusivo")
- brand: the brand or maker (e.g., "Padrón")
- line: the cigar line (e.g., "1964 Anniversary")
- vitola: the size/shape name if mentioned (e.g., "Exclusivo", "Torpedo", "Robusto") — null if not stated
- country: country of origin (e.g., "Nicaragua") — null if not stated
- wrapper: wrapper leaf type/origin (e.g., "Maduro", "Habano", "Connecticut") — null if not stated
- strength: "mild", "medium", "medium-full", "full" if explicitly stated — null otherwise
- year: release year as a 4-digit integer — null if not stated

If the title clearly isn't about a cigar (industry news, an interview, a non-cigar event), return product_name as an empty string and the rest null. The caller will skip it.

Be conservative. Don't infer fields that aren't on the page.
`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    product_name: { type: "string" },
    brand: { type: ["string", "null"] },
    line: { type: ["string", "null"] },
    vitola: { type: ["string", "null"] },
    country: { type: ["string", "null"] },
    wrapper: { type: ["string", "null"] },
    strength: { type: ["string", "null"] },
    year: { type: ["integer", "null"] },
  },
  required: ["product_name", "brand", "line", "vitola", "country", "wrapper", "strength", "year"],
  additionalProperties: false,
} as const;

export type ExtractedCigar = {
  product_name: string;
  brand: string | null;
  line: string | null;
  vitola: string | null;
  country: string | null;
  wrapper: string | null;
  strength: string | null;
  year: number | null;
};

let cachedClient: OpenAI | null = null;
function client(): OpenAI {
  if (!cachedClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY in .env.local");
    cachedClient = new OpenAI({ apiKey });
  }
  return cachedClient;
}

/**
 * Extract structured cigar metadata from a Halfwheel review title + excerpt.
 * Returns null if the model decides the title isn't about a cigar.
 */
export async function extractCigar(title: string, excerpt: string): Promise<ExtractedCigar | null> {
  const completion = await client().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Title: ${title}\n\nExcerpt:\n${excerpt.slice(0, 1500)}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "cigar_extraction", schema: RESPONSE_SCHEMA, strict: true },
    },
  });

  const raw = completion.choices[0]?.message.content;
  if (!raw) return null;

  const parsed = JSON.parse(raw) as ExtractedCigar;
  if (!parsed.product_name?.trim()) return null;
  return parsed;
}
