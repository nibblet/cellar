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
 * Look up a chip string against a synonym index. Returns the leaf id if a
 * recognized match exists, null otherwise (caller may forward to LLM mapper).
 */
export function matchChip(index: Map<string, string>, chip: string): string | null {
  const normalized = chip.trim().toLowerCase();
  if (!normalized) return null;
  return index.get(normalized) ?? null;
}
