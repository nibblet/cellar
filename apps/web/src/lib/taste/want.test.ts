import { describe, expect, it } from "vitest";
import { EMPTY_PREFERENCES, type MemberPreferences } from "@/lib/preferences/types";
import { PAIRING_TRAITS, type PairingTrait, type TraitVector } from "@/lib/wheel";
import type { TasteByType } from "./context";
import type { TasteSignal } from "./vector";
import { type RankableWant, rankWants } from "./want";

function vec(overrides: Partial<Record<PairingTrait, number>>): TraitVector {
  const v = {} as TraitVector;
  for (const trait of PAIRING_TRAITS) v[trait] = overrides[trait] ?? 0;
  return v;
}

function want(over: Partial<RankableWant> & Pick<RankableWant, "id">): RankableWant {
  return {
    id: over.id,
    type: over.type ?? "bourbon",
    specs: over.specs ?? null,
    traitVector: over.traitVector ?? null,
  };
}

const dummySignals: TasteSignal[] = [
  { traitVector: vec({ sweet: 1, woody: 1 }), loved: false },
  { traitVector: vec({ sweet: 1, woody: 1 }), loved: false },
];

function warmContext(tasteVector: TraitVector): TasteByType {
  return {
    bourbon: { tasteVector, signals: dummySignals, warm: true },
    cigar: { tasteVector: null, signals: [], warm: false },
  };
}

const coldContext: TasteByType = {
  bourbon: { tasteVector: null, signals: [], warm: false },
  cigar: { tasteVector: null, signals: [], warm: false },
};

describe("rankWants — warm", () => {
  it("orders the want list by similarity, best first", () => {
    const items = [
      want({ id: "off", traitVector: vec({ earthy: 1 }) }),
      want({ id: "match", traitVector: vec({ sweet: 1, woody: 1 }) }),
    ];
    const out = rankWants(items, warmContext(vec({ sweet: 1, woody: 1 })), EMPTY_PREFERENCES);
    expect(out.orderedIds).toEqual(["match", "off"]);
    expect(out.bestMatchId).toBe("match");
  });

  it("keeps every want — re-sort, not a filter", () => {
    const items = [
      want({ id: "a", traitVector: vec({ sweet: 1 }) }),
      want({ id: "b", traitVector: vec({ earthy: 1 }) }),
      want({ id: "c", traitVector: null }),
    ];
    const out = rankWants(items, warmContext(vec({ sweet: 1, woody: 1 })), EMPTY_PREFERENCES);
    expect(out.orderedIds).toHaveLength(3);
    expect(new Set(out.orderedIds)).toEqual(new Set(["a", "b", "c"]));
  });
});

describe("rankWants — cold start", () => {
  it("leaves order unchanged and flags no best match with no taste or prefs", () => {
    const items = [
      want({ id: "first", traitVector: vec({ sweet: 1 }) }),
      want({ id: "second", traitVector: vec({ woody: 1 }) }),
    ];
    const out = rankWants(items, coldContext, EMPTY_PREFERENCES);
    expect(out.orderedIds).toEqual(["first", "second"]);
    expect(out.bestMatchId).toBeNull();
  });

  it("sorts preference matches ahead on cold start", () => {
    const prefs: MemberPreferences = { ...EMPTY_PREFERENCES, bourbon_proof_bands: ["high"] };
    const items = [
      want({ id: "plain", specs: { proof: 80 }, traitVector: vec({ sweet: 1 }) }),
      want({ id: "pref", specs: { proof: 120 }, traitVector: vec({ earthy: 1 }) }),
    ];
    const out = rankWants(items, coldContext, prefs);
    expect(out.orderedIds).toEqual(["pref", "plain"]);
    expect(out.bestMatchId).toBe("pref");
  });
});
