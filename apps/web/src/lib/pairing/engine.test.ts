import { describe, expect, it } from "vitest";
import { PAIRING_TRAITS, type TraitVector } from "@/lib/wheel";
import { rankPairingCandidates } from "./engine";

function tv(overrides: Partial<TraitVector>): TraitVector {
  const result = {} as TraitVector;
  for (const t of PAIRING_TRAITS) result[t] = overrides[t] ?? 0;
  return result;
}

const cigarVec = tv({ earthy: 0.3, dry: 0.25, warm: 0.2 });

describe("rankPairingCandidates", () => {
  it("picks the higher-scoring bourbon when two are on the shelf pool", () => {
    const weakBourbon = {
      id: "b-weak",
      name: "Weak Match",
      brand: null,
      type: "bourbon" as const,
      trait_vector: tv({ sharp: 0.5 }),
    };
    const strongBourbon = {
      id: "b-strong",
      name: "Strong Match",
      brand: null,
      type: "bourbon" as const,
      trait_vector: tv({ sweet: 0.3, creamy: 0.3, warm: 0.2 }),
    };

    const ranked = rankPairingCandidates("cigar", cigarVec, [weakBourbon, strongBourbon], {
      limit: 1,
      minScore: 0,
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.product_id).toBe("b-strong");
    expect(ranked[0]?.score).toBeGreaterThan(
      rankPairingCandidates("cigar", cigarVec, [weakBourbon], { limit: 1, minScore: 0 })[0]
        ?.score ?? 0,
    );
  });

  it("respects limit and minScore", () => {
    const candidates = [
      {
        id: "b1",
        name: "A",
        brand: null,
        type: "bourbon" as const,
        trait_vector: tv({ sweet: 0.3, creamy: 0.3 }),
      },
      {
        id: "b2",
        name: "B",
        brand: null,
        type: "bourbon" as const,
        trait_vector: tv({ sharp: 0.5 }),
      },
    ];

    const topOne = rankPairingCandidates("cigar", cigarVec, candidates, {
      limit: 1,
      minScore: 0,
    });
    expect(topOne).toHaveLength(1);

    const strict = rankPairingCandidates("cigar", cigarVec, candidates, {
      limit: 3,
      minScore: 99,
    });
    expect(strict).toHaveLength(0);
  });
});
