import { productMatchesPreferences } from "@/lib/preferences/match";
import { hasAnyPreferences, type MemberPreferences } from "@/lib/preferences/types";
import { cosineSimilarity } from "@/lib/similarity/cosine";
import type { ProductType, TraitVector } from "@/lib/wheel";
import type { TasteByType } from "./context";
import { PREFERENCE_BOOST } from "./recommend";

export type RankableWant = {
  id: string;
  type: ProductType;
  specs: Record<string, unknown> | null;
  traitVector: TraitVector | null;
};

export type WantRanking = {
  /** Want product ids, best palate-fit first. Ties keep their input order. */
  orderedIds: string[];
  /** The strongest match, or null on a pure cold start (keeps the list chronological). */
  bestMatchId: string | null;
};

/**
 * Re-rank the member's want list by palate fit, reusing 8.1's scoring shape:
 * cosine similarity to the per-type taste vector with a flat preference boost
 * (warm path), or preference match alone (cold start).
 *
 * Unlike Try Next, nothing is dropped — every want stays on the list; this is
 * a re-sort, not a filter. A stable sort means a pure cold start with no
 * preferences leaves the list in its original (chronological) order, and
 * `bestMatchId` stays null so no "best match" marker over-promises.
 */
export function rankWants(
  items: RankableWant[],
  byType: TasteByType,
  preferences: MemberPreferences,
): WantRanking {
  const usePreferences = hasAnyPreferences(preferences);

  const scored = items.map((item, index) => {
    const { tasteVector, warm } = byType[item.type];
    const matchesPreferences = usePreferences
      ? productMatchesPreferences({ type: item.type, specs: item.specs }, preferences)
      : false;

    let score: number;
    if (warm && tasteVector && item.traitVector) {
      score = cosineSimilarity(tasteVector, item.traitVector);
      if (matchesPreferences) score += PREFERENCE_BOOST;
    } else {
      score = matchesPreferences ? 1 : 0;
    }

    return { id: item.id, score, index };
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  return {
    orderedIds: scored.map((s) => s.id),
    bestMatchId: scored.length > 0 && scored[0].score > 0 ? scored[0].id : null,
  };
}
