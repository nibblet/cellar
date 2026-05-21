import type { ProductType } from "./types";
import { getWheel } from "./wheels";

/**
 * Build a synonym → leaf-id index for fuzzy chip autocomplete and for the
 * LLM mapper's prompt. Each leaf contributes its own label + all synonyms.
 *
 * Returned keys are lowercased and trimmed. Lookup callers should normalize
 * input the same way.
 */
export function buildSynonymIndex(type: ProductType): Map<string, string> {
  const wheel = getWheel(type);
  const index = new Map<string, string>();

  for (const leaf of wheel.leaves) {
    const keys = [leaf.label, ...leaf.synonyms];
    for (const key of keys) {
      const normalized = key.trim().toLowerCase();
      if (!normalized) continue;
      // First write wins. Wheel JSON ordering is the tie-breaker.
      if (!index.has(normalized)) {
        index.set(normalized, leaf.id);
      }
    }
  }

  return index;
}

/**
 * Intensity / hedge modifiers that mean "more of" or "a bit of" without
 * changing the underlying flavor identity. We strip these before retrying
 * a synonym lookup so that "rich oak", "deep caramel", "hint of mint"
 * resolve to their head noun.
 *
 * "dark" is deliberately NOT here — it's a meaningful distinguisher in
 * the existing synonyms ("dark fruit" → dried-fruit, "dark chocolate"
 * → chocolate, "dark roast" → coffee). The exact-match pass happens first,
 * so those synonyms still resolve correctly.
 */
const INTENSITY_MODIFIERS = new Set([
  "rich",
  "deep",
  "light",
  "soft",
  "bold",
  "subtle",
  "hint",
  "touch",
  "notes",
  "note",
  "of",
  "a",
  "some",
  "lots",
]);

/**
 * Look up a chip string against a synonym index. Two-pass:
 *   1. Exact-match the normalized chip (preserves multi-word synonyms
 *      like "dark fruit", "burnt sugar", "barrel char").
 *   2. Strip intensity / hedge modifier tokens and retry. Catches
 *      "rich oak" → oak, "Rich caramel" → caramel, "hint of mint" → mint.
 *
 * Returns the leaf id on match, null otherwise (caller may forward to the
 * LLM mapper, or just store the chip text as-is).
 */
export function matchChip(index: Map<string, string>, chip: string): string | null {
  const normalized = chip.trim().toLowerCase();
  if (!normalized) return null;

  // Pass 1: exact match. Preserves existing multi-word synonyms.
  const direct = index.get(normalized);
  if (direct) return direct;

  // Pass 2: strip intensity modifiers and retry. Only fires when stripping
  // would actually change the input — single-word chips skip this step.
  const words = normalized.split(/\s+/);
  if (words.length < 2) return null;

  const significant = words.filter((w) => !INTENSITY_MODIFIERS.has(w));
  if (significant.length === 0 || significant.length === words.length) return null;

  return index.get(significant.join(" ")) ?? null;
}
