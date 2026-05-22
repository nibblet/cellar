import type { SupabaseClient } from "@supabase/supabase-js";
import type { RuleResult } from "@/lib/pairing/rules";
import { estimateCost, logUsage } from "@/lib/usage/log";
import { MODELS, openai } from "./client";

type ProseArgs = {
  cigar: { name: string; brand: string | null };
  bourbon: { name: string; brand: string | null };
  reasons: RuleResult[];
  score: number;
  supabase: SupabaseClient;
  userId: string | null;
};

/**
 * Two-shape pairing rationale. `notes` is the Bartender's 2-3-sentence prose
 * (rendered italic in the Voice block). `why_bullets` is 3-4 short reasons
 * extracted from the rules engine, rephrased plainly — fed into the bulleted
 * "Why it works" section beneath the prose. The model produces both in one
 * call so we pay one LLM round-trip per pair.
 */
export type PairingProse = {
  notes: string;
  why_bullets: string[];
};

const SYSTEM_PROMPT = `You are The Bartender at the Norton Commons Cigar Club — gentlemanly, dry, slightly archaic. You speak in serif italic; assume that's how the user sees it.

Generate a pairing rationale for a cigar + bourbon combination. You're given the products, a numeric pairing score (0-100), and a list of structured "reasons" the rules engine surfaced (these are the underlying flavor logic).

Return JSON with this exact shape:
{
  "notes": "<2-3 sentences, Bartender voice>",
  "why_bullets": ["<bullet 1>", "<bullet 2>", "<bullet 3>"]
}

Rules for "notes":
- 2 to 3 sentences. Never more.
- Plain English about how the flavors interact. No jargon, no numbers, no rule names.
- Mention specific flavor relationships (e.g., "the cigar's cocoa finds a soft landing in the bourbon's vanilla"), not just abstract trait names.
- Address the reader directly when natural; "sir" used sparingly.
- If the score is below 55, be honest about why the pair is uncertain — do not oversell.
- Plain prose. Never use markdown emphasis (no asterisks, underscores, or backticks). The italic styling is applied by the renderer.

Rules for "why_bullets":
- 3 to 4 bullets. Each one a single short phrase, 4 to 10 words.
- No leading dash or bullet character — just the text.
- Each bullet names one concrete flavor or structural reason (e.g., "cocoa cigar lands on vanilla bourbon", "shared earthy backbone", "soft proof keeps the cigar's pepper in check").
- Drop the Bartender voice here — these are crisp, plain rationale, not prose.
- Do not repeat the prose. Bullets surface what the prose left implicit.
`;

/**
 * Generate the structured pairing rationale for a single pair. The caller
 * persists the result; this function stays a pure "make the API call, log
 * the cost" entry point.
 */
export async function generatePairingProse(args: ProseArgs): Promise<PairingProse> {
  const { cigar, bourbon, reasons, score, supabase, userId } = args;

  const userMessage = [
    `Cigar: ${cigar.brand ? `${cigar.brand} — ` : ""}${cigar.name}`,
    `Bourbon: ${bourbon.brand ? `${bourbon.brand} — ` : ""}${bourbon.name}`,
    `Pairing score (0-100): ${score}`,
    "Reasons the engine surfaced:",
    ...reasons.map((r) => `- ${r.reason}`),
  ].join("\n");

  const completion = await openai().chat.completions.create({
    model: MODELS.prose,
    response_format: { type: "json_object" },
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
    operation: "pairing-prose",
    units_in: tokensIn,
    units_out: tokensOut,
    cost_usd: estimateCost(MODELS.prose, tokensIn, tokensOut),
    metadata: { score, rule_count: reasons.length },
  });

  const raw = completion.choices[0]?.message.content?.trim();
  if (!raw) throw new Error("Pairing prose generator returned no content");
  return parseProseResponse(raw);
}

/**
 * Parse the model's JSON output into a PairingProse. Tolerates a stray
 * markdown code fence and stripable emphasis, since gpt-5-mini occasionally
 * wraps JSON in ```json fences even when JSON mode is set.
 */
function parseProseResponse(raw: string): PairingProse {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<PairingProse>;
  const notes = typeof parsed.notes === "string" ? stripMarkdownEmphasis(parsed.notes) : "";
  const why_bullets = Array.isArray(parsed.why_bullets)
    ? parsed.why_bullets
        .filter((b): b is string => typeof b === "string")
        .map((b) => stripMarkdownEmphasis(b))
        .filter((b) => b.length > 0)
        .slice(0, 4)
    : [];

  if (!notes) throw new Error("Pairing prose response missing 'notes' field");
  return { notes, why_bullets };
}

/**
 * Strip the common markdown emphasis characters the model sometimes wraps
 * around its prose even when the prompt forbids them. Conservative — only
 * leading/trailing asterisks/underscores, plus matched pairs surrounding
 * the whole string. Inline emphasis inside the line is left alone (the
 * model rarely produces it, and a stray asterisk inside is less harmful
 * than an aggressive global strip that could damage punctuation).
 */
function stripMarkdownEmphasis(input: string): string {
  let text = input.trim();
  // Remove a leading run of * or _ (commonly the model opens with **...** or *...*).
  text = text.replace(/^[*_]+/, "").replace(/[*_]+$/, "");
  // Drop any stray quote characters the model wrapped around the whole line.
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("“") && text.endsWith("”"))
  ) {
    text = text.slice(1, -1);
  }
  return text.trim();
}

/**
 * Deterministic fallback used when the LLM is unavailable. Composes the
 * structured reasons into a serviceable Bartender line plus a short bullet
 * list. Not as good as the model — but always available, and the pairing
 * screen never goes empty.
 */
export function fallbackProse(args: { reasons: RuleResult[]; score: number }): PairingProse {
  const { reasons, score } = args;
  if (reasons.length === 0) {
    const notes =
      score < 50
        ? "The flavors don't share much common ground here. A curious experiment, sir."
        : "Nothing strongly objects to this pairing, sir; nothing strongly recommends it either.";
    return { notes, why_bullets: [] };
  }
  const top = reasons.slice(0, 2).map((r) => r.reason);
  const intro =
    score >= 70 ? "A fine match — " : score >= 55 ? "Worth a try — " : "An uncertain pairing — ";
  const notes = `${intro}${top.join(", and ")}.`;
  const why_bullets = reasons.slice(0, 4).map((r) => r.reason);
  return { notes, why_bullets };
}
