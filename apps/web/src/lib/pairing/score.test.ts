import { describe, expect, it } from "vitest";
import { PAIRING_TRAITS, type TraitVector } from "@/lib/wheel";
import { scorePair } from "./score";

function tv(overrides: Partial<TraitVector>): TraitVector {
  const result = {} as TraitVector;
  for (const t of PAIRING_TRAITS) result[t] = overrides[t] ?? 0;
  return result;
}

describe("scorePair", () => {
  it("returns the 50 baseline when no rule fires", () => {
    expect(scorePair(tv({}), tv({})).score).toBe(50);
  });

  it("clamps to 0..100", () => {
    // Stack favorable conditions.
    const cigar = tv({ earthy: 0.5, dry: 0.5, woody: 0.5, warm: 0.5, roasted: 0.5 });
    const bourbon = tv({
      sweet: 0.5,
      creamy: 0.5,
      woody: 0.5,
      warm: 0.5,
      roasted: 0.5,
      bright: 0.5,
    });
    const { score } = scorePair(cigar, bourbon);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("classic balanced pair scores well above baseline", () => {
    const cigar = tv({ earthy: 0.3, dry: 0.25 });
    const bourbon = tv({ sweet: 0.3, creamy: 0.3 });
    expect(scorePair(cigar, bourbon).score).toBeGreaterThan(60);
  });

  it("double-sharp pair scores below baseline", () => {
    const cigar = tv({ sharp: 0.5 });
    const bourbon = tv({ sharp: 0.5 });
    expect(scorePair(cigar, bourbon).score).toBeLessThan(50);
  });

  it("returns the same reasons list as evaluatePairing in stable order", () => {
    const cigar = tv({ earthy: 0.3, dry: 0.2, warm: 0.2 });
    const bourbon = tv({ sweet: 0.3, creamy: 0.2, warm: 0.2 });
    const first = scorePair(cigar, bourbon);
    const second = scorePair(cigar, bourbon);
    expect(first.score).toBe(second.score);
    expect(first.reasons.map((r) => r.rule)).toEqual(second.reasons.map((r) => r.rule));
  });
});
