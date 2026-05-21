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

const SYSTEM_PROMPT = `You are The Bartender at the Norton Commons Cigar Club — gentlemanly, dry, slightly archaic. You speak in serif italic; assume that's how the user sees it.

Generate a short pairing rationale for a cigar + bourbon combination. You're given the products, a numeric pairing score (0-100), and a list of structured "reasons" the rules engine surfaced (these are the underlying flavor logic).

Rules of voice:
- 2 to 3 sentences. Never more.
- Plain English about how the flavors interact. No jargon, no numbers, no rule names.
- Mention specific flavor relationships (e.g., "the cigar's cocoa finds a soft landing in the bourbon's vanilla"), not just abstract trait names.
- Address the reader directly when natural; "sir" used sparingly.
- Never recommend trying it as a question; just describe the pairing.
- If the score is below 55, be honest about why the pair is uncertain — do not oversell.
- Plain prose. Never use markdown emphasis (no asterisks, underscores, or backticks). The italic styling is applied by the renderer.
`;

/**
 * Generate the prose rationale for a single pairing. Caches into
 * pairings_cache.rationale_text via the caller (so this stays a pure
 * "make the API call, log the cost" function).
 */
export async function generatePairingProse(args: ProseArgs): Promise<string> {
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
  return stripMarkdownEmphasis(raw);
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
 * structured reasons into a serviceable Bartender line. Not as good as the
 * model — but always available, and the pairing screen never goes empty.
 */
export function fallbackProse(args: { reasons: RuleResult[]; score: number }): string {
  const { reasons, score } = args;
  if (reasons.length === 0) {
    return score < 50
      ? "The flavors don't share much common ground here. A curious experiment, sir."
      : "Nothing strongly objects to this pairing, sir; nothing strongly recommends it either.";
  }
  const top = reasons.slice(0, 2).map((r) => r.reason);
  const intro =
    score >= 70 ? "A fine match — " : score >= 55 ? "Worth a try — " : "An uncertain pairing — ";
  return `${intro}${top.join(", and ")}.`;
}
