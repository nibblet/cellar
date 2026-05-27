import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupVoice } from "@/lib/aggregation/group-voice";
import type { AdjacentProduct } from "@/lib/similarity/suggest-adjacent";
import type { ProductType, WheelVector } from "@/lib/wheel";
import { estimateCost, logUsage } from "@/lib/usage/log";
import { MODELS, openai } from "./client";

export type WinstonProseInput = {
  productId: string;
  productType: ProductType;
  name: string;
  brand: string | null;
  specs: Record<string, unknown>;
  wheelVector: WheelVector | null;
  groupVoice: GroupVoice;
  adjacent: AdjacentProduct[];
};

const SYSTEM_PROMPT = `You are Winston, the resident narrator at the Norton Commons Cigar Club — gentlemanly, dry, slightly archaic. You speak in serif italic; assume that's how the user sees it. Never refer to yourself as "the Bartender"; if you sign off or self-reference, you are Winston.

You are writing a tasting paragraph for a product detail page. One paragraph, 3 to 5 sentences. Your job is to make a member FEEL what this product is about before they light it or pour it.

Structure (weave naturally, don't use headers or bullets):
1. Open with the product's character — body, wrapper/mash bill, origin, what kind of experience to expect.
2. Guide the palate — what flavors to look for, in what order if relevant (first third / mid / finish for cigars, nose / entry / finish for bourbon).
3. If club members have weighed in, fold in what the room found. Name members naturally (e.g. "Paul C found…"). Don't just list — characterize.
4. Close with a "try next" nudge if similar products are provided — one sentence connecting this product to something adjacent.

Rules:
- One paragraph. 3 to 5 sentences. Never more.
- Plain prose. Never use markdown emphasis (no asterisks, underscores, or backticks). The italic styling is applied by the renderer.
- Be specific: name wrapper types, regions, distilleries, proof, flavor notes — whatever the data supports.
- Address the reader directly when natural; "sir" used once at most.
- Warm and witty, never condescending. The wink is in the details.
- If no CLUB DATA section appears in the input, NO members have tried this product. Do NOT mention any member names, do NOT say "the room found" or "the club noted" or anything implying members have tasted it. Write purely from product specs and wheel data.
- NEVER invent member names, quotes, or tasting experiences. Only reference members explicitly listed in the CLUB DATA section. There is no "Maria" in this club. If you are unsure, omit the member reference entirely.
- For the "try next" nudge, briefly say WHY the adjacent product relates ("same wheated DNA", "trades the pepper for chocolate", etc.).
- Do not invent facts not supported by the input data. Do not sign off with "— Winston" or similar.
`;

function buildUserMessage(input: WinstonProseInput): string {
  const { productType, name, brand, specs, wheelVector, groupVoice, adjacent } = input;
  const lines: string[] = [];

  lines.push(`PRODUCT: ${brand ? `${brand} — ` : ""}${name}`);
  lines.push(`TYPE: ${productType}`);

  const specLines: string[] = [];
  if (productType === "cigar") {
    if (specs.wrapper) specLines.push(`Wrapper: ${specs.wrapper}`);
    if (specs.binder) specLines.push(`Binder: ${specs.binder}`);
    if (specs.filler) specLines.push(`Filler: ${specs.filler}`);
    if (specs.country) specLines.push(`Country: ${specs.country}`);
    if (specs.strength) specLines.push(`Strength: ${specs.strength}`);
    if (specs.body) specLines.push(`Body: ${specs.body}`);
    if (specs.vitola) specLines.push(`Vitola: ${specs.vitola}`);
    if (specs.wrapper_color) specLines.push(`Wrapper color: ${specs.wrapper_color}`);
    if (specs.factory) specLines.push(`Factory: ${specs.factory}`);
  } else {
    if (specs.distillery) specLines.push(`Distillery: ${specs.distillery}`);
    if (specs.proof) specLines.push(`Proof: ${specs.proof}`);
    if (specs.age_label) specLines.push(`Age: ${specs.age_label} year`);
    if (specs.expression_type) specLines.push(`Style: ${specs.expression_type}`);
    if (specs.whiskey_type) specLines.push(`Type: ${specs.whiskey_type}`);
    if (specs.availability_rarity) specLines.push(`Availability: ${specs.availability_rarity}`);
  }
  if (specLines.length > 0) {
    lines.push(`SPECS:\n${specLines.join("\n")}`);
  }

  if (wheelVector && Object.keys(wheelVector).length > 0) {
    const sorted = Object.entries(wheelVector)
      .filter(([, v]) => typeof v === "number" && v >= 2)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 8);
    if (sorted.length > 0) {
      lines.push(`TOP FLAVOR NOTES: ${sorted.map(([k, v]) => `${k} (${v})`).join(", ")}`);
    }
  }

  if (groupVoice.member_count > 0) {
    lines.push(`\nCLUB DATA (${groupVoice.member_count} member${groupVoice.member_count === 1 ? "" : "s"}, ${groupVoice.recommend_count} recommend):`);
    for (const take of groupVoice.takes.slice(0, 5)) {
      const parts = [take.display_name];
      if (take.recommend) parts.push("recommends");
      if (take.chips.length > 0) parts.push(`chips: ${take.chips.join(", ")}`);
      if (take.note) parts.push(`note: "${take.note}"`);
      lines.push(`- ${parts.join(" · ")}`);
    }

    if (groupVoice.tag_cloud.length > 0) {
      const tags = groupVoice.tag_cloud.slice(0, 6).map((t) => t.label);
      lines.push(`Room consensus flavors: ${tags.join(", ")}`);
    }
  }

  if (adjacent.length > 0) {
    lines.push(`\nSIMILAR PRODUCTS (for "try next" nudge):`);
    for (const a of adjacent.slice(0, 2)) {
      lines.push(`- ${a.brand ? `${a.brand} — ` : ""}${a.name} (similarity: ${Math.round(a.similarity * 100)}%)`);
    }
  }

  return lines.join("\n");
}

export async function generateWinstonProse(
  input: WinstonProseInput,
  supabase: SupabaseClient,
  userId: string | null,
): Promise<string> {
  const userMessage = buildUserMessage(input);

  const completion = await openai().chat.completions.create({
    model: MODELS.prose,
    reasoning_effort: "minimal",
    response_format: { type: "text" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const tokensIn = completion.usage?.prompt_tokens ?? 0;
  const tokensOut = completion.usage?.completion_tokens ?? 0;

  void logUsage(supabase, {
    user_id: userId,
    provider: "openai",
    model: MODELS.prose,
    operation: "winston-prose",
    units_in: tokensIn,
    units_out: tokensOut,
    cost_usd: estimateCost(MODELS.prose, tokensIn, tokensOut),
    metadata: { product_id: input.productId, member_count: input.groupVoice.member_count },
  });

  const raw = completion.choices[0]?.message.content?.trim();
  if (!raw) throw new Error("Winston prose generator returned no content");
  return cleanProse(raw);
}

function cleanProse(input: string): string {
  let text = input.trim();
  text = text.replace(/^[*_]+/, "").replace(/[*_]+$/, "");
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("\u201c") && text.endsWith("\u201d"))
  ) {
    text = text.slice(1, -1);
  }
  text = text.replace(/\n+\s*[—–-]+\s*Winston\s*$/i, "");
  text = text.replace(/[*_]+$/, "");
  return text.trim();
}
