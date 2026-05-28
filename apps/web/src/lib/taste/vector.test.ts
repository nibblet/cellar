import { describe, expect, it } from "vitest";
import { PAIRING_TRAITS, type PairingTrait, type TraitVector } from "@/lib/wheel";
import {
  buildTasteVector,
  COLD_START_THRESHOLD,
  dominantTraits,
  SIGNAL_WEIGHT,
  type TasteSignal,
  totalSignalWeight,
} from "./vector";

function vec(overrides: Partial<Record<PairingTrait, number>>): TraitVector {
  const v = {} as TraitVector;
  for (const trait of PAIRING_TRAITS) v[trait] = overrides[trait] ?? 0;
  return v;
}

describe("buildTasteVector", () => {
  it("returns null with no signals", () => {
    expect(buildTasteVector([])).toBeNull();
  });

  it("averages a single signal to itself", () => {
    const v = vec({ sweet: 0.8, woody: 0.4 });
    const taste = buildTasteVector([{ traitVector: v, loved: false }]);
    expect(taste?.sweet).toBeCloseTo(0.8);
    expect(taste?.woody).toBeCloseTo(0.4);
    expect(taste?.earthy).toBeCloseTo(0);
  });

  it("weights a loved signal triple a tried signal", () => {
    const loved = vec({ sweet: 1 });
    const tried = vec({ earthy: 1 });
    const taste = buildTasteVector([
      { traitVector: loved, loved: true },
      { traitVector: tried, loved: false },
    ]);
    // total weight = 3 + 1 = 4; sweet contributes 3/4, earthy 1/4
    expect(taste?.sweet).toBeCloseTo(0.75);
    expect(taste?.earthy).toBeCloseTo(0.25);
  });

  it("keeps the result bounded 0–1 (weighted average, not sum)", () => {
    const taste = buildTasteVector([
      { traitVector: vec({ sweet: 1 }), loved: true },
      { traitVector: vec({ sweet: 1 }), loved: false },
    ]);
    expect(taste?.sweet).toBeCloseTo(1);
  });
});

describe("totalSignalWeight", () => {
  it("sums loved=3 and tried=1", () => {
    const signals: TasteSignal[] = [
      { traitVector: vec({}), loved: true },
      { traitVector: vec({}), loved: false },
      { traitVector: vec({}), loved: false },
    ];
    expect(totalSignalWeight(signals)).toBe(SIGNAL_WEIGHT.loved + 2 * SIGNAL_WEIGHT.tried);
  });

  it("a single love clears the cold-start threshold; a single tried does not", () => {
    expect(totalSignalWeight([{ traitVector: vec({}), loved: true }])).toBeGreaterThanOrEqual(
      COLD_START_THRESHOLD,
    );
    expect(totalSignalWeight([{ traitVector: vec({}), loved: false }])).toBeLessThan(
      COLD_START_THRESHOLD,
    );
  });
});

describe("dominantTraits", () => {
  it("returns strongest traits highest-first, dropping near-zero", () => {
    const v = vec({ sweet: 0.9, woody: 0.5, earthy: 0.01, fruity: 0.3 });
    expect(dominantTraits(v, 3)).toEqual(["sweet", "woody", "fruity"]);
  });

  it("respects the limit", () => {
    const v = vec({ sweet: 0.9, woody: 0.8, earthy: 0.7, fruity: 0.6 });
    expect(dominantTraits(v, 2)).toEqual(["sweet", "woody"]);
  });
});
