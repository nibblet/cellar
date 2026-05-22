/**
 * gpt-5-nano fallback for picking a hero product image when the regex/heuristic
 * pass yields zero candidates.
 *
 * We give the model the list of every image URL the actor's markdown contained
 * (logos, ads, hero shots, all of it) and have it return an index into the
 * list — not a URL string — so it can't hallucinate.
 */

import type OpenAI from "openai";
import type { RagItem } from "./apify-client";

const MODEL = "gpt-5-nano";

const SYSTEM = `You pick the best hero product image for a cigar or bourbon from a list of image URLs scraped from review pages.

Rules:
- The "hero image" is a clear, well-lit product photo of the cigar or bottle itself.
- AVOID: site logos, author avatars, social/sharing icons, ads, banners, related-post thumbnails of OTHER products, tiny dimensions (anything with ?w= or ?s= under 100).
- PREFER: filenames or URLs containing the product name slug, or generic words like "cigar"/"bottle"/"bourbon".
- If multiple candidates look acceptable, prefer the highest-resolution one.
- If NONE of the URLs are an acceptable hero image, return index -1.

Return only the index of your chosen URL (0-based), or -1.`;

const IMAGE_RE = /!\[[^\]]*\]\((https?:\/\/[^)\s]+\.(?:jpe?g|png|webp|gif|avif))[^)]*\)/gi;

function collectAllImageUrls(items: RagItem[]): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    const md = item.markdown ?? "";
    for (const m of md.matchAll(IMAGE_RE)) seen.add(m[1]);
  }
  return [...seen];
}

export type LlmPickResult = {
  imageUrl: string | null;
  tokensIn: number;
  tokensOut: number;
};

export async function pickImageWithLlm(
  client: OpenAI,
  items: RagItem[],
  product: { name: string; brand?: string | null; type: "bourbon" | "cigar" },
): Promise<LlmPickResult> {
  const urls = collectAllImageUrls(items);
  if (!urls.length) return { imageUrl: null, tokensIn: 0, tokensOut: 0 };

  const userMessage = JSON.stringify({
    product_type: product.type,
    brand: product.brand ?? null,
    name: product.name,
    image_urls: urls,
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
        name: "image_pick",
        schema: {
          type: "object",
          properties: {
            index: { type: "integer", minimum: -1 },
            reason: { type: "string" },
          },
          required: ["index", "reason"],
          additionalProperties: false,
        },
        strict: true,
      },
    },
  });

  const raw = completion.choices[0]?.message.content;
  const tokensIn = completion.usage?.prompt_tokens ?? 0;
  const tokensOut = completion.usage?.completion_tokens ?? 0;
  if (!raw) return { imageUrl: null, tokensIn, tokensOut };

  const parsed = JSON.parse(raw) as { index: number; reason: string };
  const idx = parsed.index;
  if (idx < 0 || idx >= urls.length) {
    return { imageUrl: null, tokensIn, tokensOut };
  }
  return { imageUrl: urls[idx], tokensIn, tokensOut };
}
