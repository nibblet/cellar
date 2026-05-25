import { describe, expect, it } from "vitest";
import { PAIRING_TRAITS, type TraitVector } from "@/lib/wheel";
import { cosineSimilarity } from "./cosine";

function tv(overrides: Partial<TraitVector>): TraitVector {
  const result = {} as TraitVector;
  for (const t of PAIRING_TRAITS) result[t] = overrides[t] ?? 0;
  return result;
}

describe("cosineSimilarity", () => {
  it("returns 1 for identical non-zero vectors", () => {
    const v = tv({ woody: 0.8, warm: 0.6, sweet: 0.4 });
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity(tv({ woody: 1 }), tv({ fruity: 1 }))).toBe(0);
  });

  it("returns 0 when either vector is zero", () => {
    expect(cosineSimilarity(tv({}), tv({ woody: 1 }))).toBe(0);
  });
});
