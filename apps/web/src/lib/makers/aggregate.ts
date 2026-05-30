import type { TraitVector } from "@/lib/wheel";

/**
 * Aggregate multiple trait vectors into a single average vector.
 * Only traits present in at least half the vectors are included.
 */
export function aggregateTraitVectors(vectors: TraitVector[]): TraitVector {
  if (vectors.length === 0) return {} as TraitVector;

  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const v of vectors) {
    for (const [k, val] of Object.entries(v)) {
      if (typeof val !== "number") continue;
      sums[k] = (sums[k] ?? 0) + val;
      counts[k] = (counts[k] ?? 0) + 1;
    }
  }

  const result = {} as TraitVector;
  const threshold = vectors.length / 2;

  for (const k of Object.keys(sums)) {
    if (counts[k] >= threshold) {
      result[k as keyof TraitVector] = sums[k] / vectors.length;
    }
  }

  return result;
}
