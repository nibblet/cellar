/**
 * Pure helpers for product-name normalization and similarity scoring.
 * Used by the identification orchestrator to decide whether an AI-extracted
 * product name matches an existing catalog entry.
 */

/**
 * Normalize a name for comparison: strip diacritics, lowercase, collapse
 * whitespace, drop punctuation. Preserves alphanumerics and spaces only.
 */
export function normalizeName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trigram Jaccard similarity. Works decently for short product names.
 * Returns 0..1 where 1 is identical and 0 is no shared trigrams.
 *
 * This is the same family of metric pg_trgm uses, so client + server
 * scoring stay roughly consistent.
 */
export function trigramSimilarity(a: string, b: string): number {
  const aTri = trigramsOf(normalizeName(a));
  const bTri = trigramsOf(normalizeName(b));
  if (aTri.size === 0 && bTri.size === 0) return 1;
  if (aTri.size === 0 || bTri.size === 0) return 0;

  let intersection = 0;
  for (const t of aTri) if (bTri.has(t)) intersection += 1;
  const union = aTri.size + bTri.size - intersection;
  return intersection / union;
}

function trigramsOf(text: string): Set<string> {
  const padded = `  ${text}  `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 2; i += 1) {
    set.add(padded.slice(i, i + 3));
  }
  return set;
}

export type CandidateProduct = {
  id: string;
  name: string;
  brand: string | null;
};

export type MatchScore = {
  product: CandidateProduct;
  score: number;
  matched: "name+brand" | "name" | null;
};

/**
 * Rank a list of candidate products against an extracted name+brand pair.
 * Returns the top scorer with its similarity score; caller decides on a
 * threshold (recommended >= 0.55 for "name+brand", >= 0.7 for "name" alone).
 */
export function pickBestMatch(
  candidates: CandidateProduct[],
  extracted: { name: string; brand: string | null },
): MatchScore | null {
  let best: MatchScore | null = null;

  for (const candidate of candidates) {
    const nameScore = trigramSimilarity(extracted.name, candidate.name);

    // If both have a brand, weight a brand match heavily.
    if (extracted.brand && candidate.brand) {
      const brandScore = trigramSimilarity(extracted.brand, candidate.brand);
      const combined = 0.4 * brandScore + 0.6 * nameScore;
      if (!best || combined > best.score) {
        best = { product: candidate, score: combined, matched: "name+brand" };
      }
    } else if (!best || nameScore > best.score) {
      best = { product: candidate, score: nameScore, matched: "name" };
    }
  }

  return best;
}
