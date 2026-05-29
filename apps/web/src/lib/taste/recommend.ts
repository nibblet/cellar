import { productMatchesPreferences } from "@/lib/preferences/match";
import { hasAnyPreferences, type MemberPreferences } from "@/lib/preferences/types";
import { cosineSimilarity } from "@/lib/similarity/cosine";
import type { ProductType, TraitVector } from "@/lib/wheel";
import { COLD_START_THRESHOLD, type TasteSignal, totalSignalWeight } from "./vector";

export type TasteCandidate = {
  id: string;
  type: ProductType;
  name: string;
  brand: string | null;
  image_url: string | null;
  specs: Record<string, unknown> | null;
  traitVector: TraitVector | null;
};

export type ScoredCandidate = {
  candidate: TasteCandidate;
  score: number;
  matchesPreferences: boolean;
  coldStart: boolean;
};

/** Additive bonus for a candidate that also matches the member's stated preferences. */
export const PREFERENCE_BOOST = 0.15;

export const RECOMMENDATIONS_PER_TYPE = 3;

export type RecommendParams = {
  type: ProductType;
  tasteVector: TraitVector | null;
  signals: TasteSignal[];
  candidates: TasteCandidate[];
  exclude: ReadonlySet<string>;
  preferences: MemberPreferences;
  limit?: number;
};

/**
 * Rank one product type's confirmed catalog against the member's palate.
 *
 * Warm path (enough tried/loved signal): cosine similarity to the taste
 * vector, plus a flat boost for candidates that also match stated preferences.
 *
 * Cold start (thin signal — few trieds, zero loves): fall back to preferences
 * alone. Matching candidates score 1, the rest 0. With no preferences either,
 * nothing surfaces — we don't guess from an empty palate.
 *
 * Always excluded: candidates of the wrong type, anything already in the
 * member's cellar (have/want/tried/loved), and — on the warm path — anything
 * without a trait vector (we can't assess its palate fit).
 */
export function recommendForType(params: RecommendParams): ScoredCandidate[] {
  const { type, tasteVector, signals, candidates, exclude, preferences } = params;
  const limit = params.limit ?? RECOMMENDATIONS_PER_TYPE;

  const warm = tasteVector !== null && totalSignalWeight(signals) >= COLD_START_THRESHOLD;
  const usePreferences = hasAnyPreferences(preferences);

  const scored: ScoredCandidate[] = [];

  for (const candidate of candidates) {
    if (candidate.type !== type) continue;
    if (exclude.has(candidate.id)) continue;

    const matchesPreferences = usePreferences
      ? productMatchesPreferences({ type: candidate.type, specs: candidate.specs }, preferences)
      : false;

    let score = 0;
    if (warm && tasteVector && candidate.traitVector) {
      score = cosineSimilarity(tasteVector, candidate.traitVector);
      if (matchesPreferences) score += PREFERENCE_BOOST;
    } else if (!warm) {
      score = matchesPreferences ? 1 : 0;
    }

    if (score <= 0) continue;

    scored.push({ candidate, score, matchesPreferences, coldStart: !warm });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
