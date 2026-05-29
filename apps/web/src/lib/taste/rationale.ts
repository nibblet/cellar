import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS, openai } from "@/lib/openai/client";
import { estimateCost, logUsage } from "@/lib/usage/log";
import type { PairingTrait, ProductType } from "@/lib/wheel";

export type RationalePick = {
  productId: string;
  name: string;
  brand: string | null;
  type: ProductType;
  specs: Record<string, unknown> | null;
};

export type TasteProfile = {
  /** Dominant traits from the member's palate, e.g. ["sweet", "woody"]. Empty on cold start. */
  traits: PairingTrait[];
  /** Names of a few products the member loved, for grounding. */
  lovedExamples: string[];
  /** True when there's no real taste vector and picks lean on stated preferences. */
  coldStart: boolean;
};

const SYSTEM_PROMPT = `You are Winston, the resident narrator at the Norton Commons Cigar Club — a warm Kentucky raconteur with a tasting habit. You speak in serif italic; assume that's how the user sees it.

You are writing the one-line reason each suggested product fits a member's palate. These appear under a "Try Next" header on the member's private cellar page.

Return JSON with this exact shape:
{
  "rationales": [
    { "id": "<the product id given>", "line": "<one short sentence>" }
  ]
}

Rules:
- One sentence per product. Roughly 8 to 16 words. Never two sentences.
- Speak to why it fits THIS palate — connect it to the dominant traits or the loved examples provided.
- Be specific where the data supports it (wrapper, mash bill, proof, a flavor note) but stay in one line.
- Plain prose. No markdown emphasis, no asterisks, no quotation marks around the line.
- Do NOT use "sir". Drop butler vocabulary (humidor, shelves, the door, leather chairs).
- Warm, opinionated, never a sales pitch. No exclamation marks.
- Never invent club members, quotes, or facts not implied by the data.
- Return one object per product id given, using the exact id strings.
`;

function buildUserMessage(picks: RationalePick[], profile: TasteProfile): string {
  const lines: string[] = [];

  if (profile.coldStart || profile.traits.length === 0) {
    lines.push("PALATE: not yet established — lean on the product's own character.");
  } else {
    lines.push(`PALATE LEANS: ${profile.traits.join(", ")}`);
  }
  if (profile.lovedExamples.length > 0) {
    lines.push(`HAS LOVED: ${profile.lovedExamples.join("; ")}`);
  }

  lines.push("\nSUGGESTED PRODUCTS:");
  for (const pick of picks) {
    const specs = pick.specs ?? {};
    const details: string[] = [];
    if (pick.type === "cigar") {
      if (specs.strength) details.push(String(specs.strength));
      if (specs.wrapper) details.push(`${specs.wrapper} wrapper`);
      if (specs.origin) details.push(String(specs.origin));
    } else {
      if (specs.proof) details.push(`${specs.proof} proof`);
      if (specs.expression_type) details.push(String(specs.expression_type));
      if (specs.mashbill_type) details.push(String(specs.mashbill_type));
    }
    const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";
    lines.push(
      `- id=${pick.productId} · ${pick.brand ? `${pick.brand} — ` : ""}${pick.name}${suffix}`,
    );
  }

  return lines.join("\n");
}

/**
 * Deterministic fallback line, used when the LLM call fails or omits a pick.
 * Keeps every Try Next card captioned even on a generation error.
 */
export function fallbackRationale(profile: TasteProfile): string {
  if (!profile.coldStart && profile.traits.length > 0) {
    return `Leans the ${profile.traits.join(", ")} profile you keep coming back to.`;
  }
  return "A solid match for the preferences you've set.";
}

/**
 * Generate a one-line Winston rationale for each pick in a single LLM call.
 * Returns a map of product id → line. Missing picks fall back to a
 * deterministic line so every card is captioned.
 */
export async function generateRationales(
  picks: RationalePick[],
  profile: TasteProfile,
  supabase: SupabaseClient,
  userId: string | null,
): Promise<Record<string, string>> {
  const fallback = fallbackRationale(profile);
  const result: Record<string, string> = {};
  for (const pick of picks) result[pick.productId] = fallback;

  if (picks.length === 0) return result;

  try {
    const completion = await openai().chat.completions.create({
      model: MODELS.prose,
      reasoning_effort: "minimal",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(picks, profile) },
      ],
    });

    const tokensIn = completion.usage?.prompt_tokens ?? 0;
    const tokensOut = completion.usage?.completion_tokens ?? 0;
    void logUsage(supabase, {
      user_id: userId,
      provider: "openai",
      model: MODELS.prose,
      operation: "taste-rationale",
      units_in: tokensIn,
      units_out: tokensOut,
      cost_usd: estimateCost(MODELS.prose, tokensIn, tokensOut),
      metadata: { pick_count: picks.length, cold_start: profile.coldStart },
    });

    const raw = completion.choices[0]?.message.content?.trim();
    if (raw) {
      for (const { id, line } of parseRationales(raw)) {
        if (id in result && line) result[id] = line;
      }
    }
  } catch (err) {
    console.warn("[taste-rationale] generation failed:", err);
  }

  return result;
}

function parseRationales(raw: string): Array<{ id: string; line: string }> {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const parsed = JSON.parse(cleaned) as { rationales?: unknown };
  if (!Array.isArray(parsed.rationales)) return [];

  const out: Array<{ id: string; line: string }> = [];
  for (const entry of parsed.rationales) {
    if (entry && typeof entry === "object") {
      const id = (entry as Record<string, unknown>).id;
      const line = (entry as Record<string, unknown>).line;
      if (typeof id === "string" && typeof line === "string") {
        out.push({ id, line: cleanLine(line) });
      }
    }
  }
  return out;
}

function cleanLine(input: string): string {
  let text = input.trim();
  text = text.replace(/^[*_"“]+/, "").replace(/[*_"”]+$/, "");
  return text.trim();
}
