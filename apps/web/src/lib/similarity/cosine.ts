import { PAIRING_TRAITS, type TraitVector } from "@/lib/wheel";

/**
 * Cosine similarity between two normalized trait vectors (0–1 per trait).
 * Returns 0 when either vector has zero magnitude.
 */
export function cosineSimilarity(a: TraitVector, b: TraitVector): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const trait of PAIRING_TRAITS) {
    const av = a[trait];
    const bv = b[trait];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
