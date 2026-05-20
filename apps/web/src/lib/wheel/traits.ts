import { PAIRING_TRAITS, type ProductType, type TraitVector, type WheelVector } from "./types";
import { getWheel } from "./wheels";

/**
 * Roll up a sparse wheel vector to a normalized trait vector.
 *
 * For each pairing trait, sum the intensities of every leaf carrying that trait,
 * then normalize to 0–1 by dividing by the theoretical maximum (count of leaves
 * with that trait × 5).
 *
 * This produces a stable, scale-free representation that the pairing engine
 * can compare across products regardless of how many descriptors fired.
 */
export function rollUpTraits(type: ProductType, wheelVector: WheelVector): TraitVector {
  const wheel = getWheel(type);

  // Precompute trait → leaf-count and trait → intensity-sum in one pass.
  const traitMaxima: Record<string, number> = {};
  const traitSums: Record<string, number> = {};

  for (const trait of PAIRING_TRAITS) {
    traitMaxima[trait] = 0;
    traitSums[trait] = 0;
  }

  for (const leaf of wheel.leaves) {
    for (const trait of leaf.pairing_traits) {
      traitMaxima[trait] += 5; // each leaf contributes max 5 to its traits
    }
  }

  for (const [leafId, score] of Object.entries(wheelVector)) {
    if (score < 1) continue;
    const leaf = wheel.leaves.find((l) => l.id === leafId);
    if (!leaf) continue; // unknown leaf id (older wheel version); ignore gracefully
    const clamped = Math.max(0, Math.min(5, score));
    for (const trait of leaf.pairing_traits) {
      traitSums[trait] += clamped;
    }
  }

  const result = {} as TraitVector;
  for (const trait of PAIRING_TRAITS) {
    const max = traitMaxima[trait];
    result[trait] = max > 0 ? traitSums[trait] / max : 0;
  }
  return result;
}

/**
 * Build a map of leaf → label and leaf → category, useful for rendering tag
 * clouds and explanations without re-traversing the wheel.
 */
export function indexLeaves(type: ProductType): Map<string, { label: string; categoryId: string }> {
  const wheel = getWheel(type);
  const map = new Map<string, { label: string; categoryId: string }>();
  for (const leaf of wheel.leaves) {
    map.set(leaf.id, { label: leaf.label, categoryId: leaf.category_id });
  }
  return map;
}
