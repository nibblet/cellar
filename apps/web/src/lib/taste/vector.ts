import { PAIRING_TRAITS, type PairingTrait, type TraitVector } from "@/lib/wheel";

/**
 * A single taste signal: one product the member has tried or loved, carrying
 * that product's normalized trait vector. `loved` pulls harder than a plain
 * `tried` — see SIGNAL_WEIGHT.
 */
export type TasteSignal = {
  traitVector: TraitVector;
  loved: boolean;
};

/** Relative pull of each signal kind on the taste vector. A love counts triple. */
export const SIGNAL_WEIGHT = {
  loved: 3,
  tried: 1,
} as const;

/**
 * Below this total signal weight the palate read is too thin to trust, so the
 * recommender falls back to stated preferences alone (cold start). Two plain
 * trieds — or a single love — clears the bar.
 */
export const COLD_START_THRESHOLD = 2;

export function signalWeight(signal: TasteSignal): number {
  return signal.loved ? SIGNAL_WEIGHT.loved : SIGNAL_WEIGHT.tried;
}

export function totalSignalWeight(signals: TasteSignal[]): number {
  return signals.reduce((sum, s) => sum + signalWeight(s), 0);
}

function zeroVector(): TraitVector {
  const v = {} as TraitVector;
  for (const trait of PAIRING_TRAITS) v[trait] = 0;
  return v;
}

/**
 * Weighted-average the member's tried/loved trait vectors into one taste
 * vector in the same 0–1 trait space the pairing engine uses. Returns null
 * when there is no signal to average.
 *
 * Cosine similarity is scale-invariant, so dividing by the total weight does
 * not change ranking — but it keeps the result bounded 0–1, matching the
 * product trait vectors and reading cleanly in tests.
 */
export function buildTasteVector(signals: TasteSignal[]): TraitVector | null {
  const totalWeight = totalSignalWeight(signals);
  if (totalWeight === 0) return null;

  const sum = zeroVector();
  for (const signal of signals) {
    const w = signalWeight(signal);
    for (const trait of PAIRING_TRAITS) {
      sum[trait] += w * signal.traitVector[trait];
    }
  }

  for (const trait of PAIRING_TRAITS) {
    sum[trait] /= totalWeight;
  }
  return sum;
}

/**
 * The member's strongest traits, highest first — used to describe their palate
 * to Winston for the rationale prose. Near-zero traits are dropped.
 */
export function dominantTraits(vector: TraitVector, limit = 3): PairingTrait[] {
  return PAIRING_TRAITS.filter((trait) => vector[trait] > 0.05)
    .sort((a, b) => vector[b] - vector[a])
    .slice(0, limit);
}
