import { describe, expect, it } from "vitest";
import { PAIRING_TRAITS, type PairingTrait, type TraitVector } from "@/lib/wheel";
import { aggregateTraitVectors } from "./aggregate";

function vec(overrides: Partial<Record<PairingTrait, number>>): TraitVector {
  const v = {} as TraitVector;
  for (const trait of PAIRING_TRAITS) v[trait] = overrides[trait] ?? 0;
  return v;
}

describe("aggregateTraitVectors", () => {
  it("returns empty vector for no inputs", () => {
    expect(aggregateTraitVectors([])).toEqual({});
  });

  it("averages traits present in all vectors", () => {
    const result = aggregateTraitVectors([
      vec({ sweet: 0.8, woody: 0.4 }),
      vec({ sweet: 0.4, woody: 0.6 }),
    ]);
    expect(result.sweet).toBeCloseTo(0.6);
    expect(result.woody).toBeCloseTo(0.5);
  });

  it("drops traits present in fewer than half the vectors", () => {
    const result = aggregateTraitVectors([
      { sweet: 1, earthy: 0.9 } as TraitVector,
      { sweet: 0.5 } as TraitVector,
      { sweet: 0.3 } as TraitVector,
    ]);
    expect(result.sweet).toBeCloseTo(0.6);
    expect(result.earthy).toBeUndefined();
  });
});
