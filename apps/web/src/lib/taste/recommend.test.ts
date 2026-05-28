import { describe, expect, it } from "vitest";
import { EMPTY_PREFERENCES, type MemberPreferences } from "@/lib/preferences/types";
import { PAIRING_TRAITS, type PairingTrait, type TraitVector } from "@/lib/wheel";
import { recommendForType, type TasteCandidate } from "./recommend";
import type { TasteSignal } from "./vector";

function vec(overrides: Partial<Record<PairingTrait, number>>): TraitVector {
  const v = {} as TraitVector;
  for (const trait of PAIRING_TRAITS) v[trait] = overrides[trait] ?? 0;
  return v;
}

function candidate(over: Partial<TasteCandidate> & Pick<TasteCandidate, "id">): TasteCandidate {
  return {
    id: over.id,
    type: over.type ?? "bourbon",
    name: over.name ?? over.id,
    brand: over.brand ?? null,
    image_url: over.image_url ?? null,
    specs: over.specs ?? null,
    traitVector: over.traitVector ?? null,
  };
}

// Two trieds clears the cold-start threshold.
const warmSignals: TasteSignal[] = [
  { traitVector: vec({ sweet: 1, woody: 1 }), loved: false },
  { traitVector: vec({ sweet: 1, woody: 1 }), loved: false },
];

describe("recommendForType — warm path (taste vector)", () => {
  const tasteVector = vec({ sweet: 1, woody: 1 });

  it("ranks by similarity to the taste vector", () => {
    const candidates = [
      candidate({ id: "match", traitVector: vec({ sweet: 1, woody: 1 }) }),
      candidate({ id: "off", traitVector: vec({ earthy: 1, sharp: 1 }) }),
    ];
    const out = recommendForType({
      type: "bourbon",
      tasteVector,
      signals: warmSignals,
      candidates,
      exclude: new Set(),
      preferences: EMPTY_PREFERENCES,
    });
    expect(out[0]?.candidate.id).toBe("match");
    expect(out[0]?.coldStart).toBe(false);
  });

  it("excludes products already in the cellar", () => {
    const candidates = [
      candidate({ id: "owned", traitVector: vec({ sweet: 1, woody: 1 }) }),
      candidate({ id: "fresh", traitVector: vec({ sweet: 0.9, woody: 0.9 }) }),
    ];
    const out = recommendForType({
      type: "bourbon",
      tasteVector,
      signals: warmSignals,
      candidates,
      exclude: new Set(["owned"]),
      preferences: EMPTY_PREFERENCES,
    });
    expect(out.map((s) => s.candidate.id)).toEqual(["fresh"]);
  });

  it("keeps recommendations strictly within type", () => {
    const candidates = [
      candidate({ id: "bourbon-a", type: "bourbon", traitVector: vec({ sweet: 1, woody: 1 }) }),
      candidate({ id: "cigar-a", type: "cigar", traitVector: vec({ sweet: 1, woody: 1 }) }),
    ];
    const out = recommendForType({
      type: "bourbon",
      tasteVector,
      signals: warmSignals,
      candidates,
      exclude: new Set(),
      preferences: EMPTY_PREFERENCES,
    });
    expect(out.map((s) => s.candidate.id)).toEqual(["bourbon-a"]);
  });

  it("skips candidates without a trait vector on the warm path", () => {
    const candidates = [candidate({ id: "no-vector", traitVector: null })];
    const out = recommendForType({
      type: "bourbon",
      tasteVector,
      signals: warmSignals,
      candidates,
      exclude: new Set(),
      preferences: EMPTY_PREFERENCES,
    });
    expect(out).toEqual([]);
  });

  it("boosts a preference match above an equal-similarity non-match", () => {
    const prefs: MemberPreferences = {
      ...EMPTY_PREFERENCES,
      bourbon_proof_bands: ["high"],
    };
    const candidates = [
      candidate({
        id: "pref-match",
        traitVector: vec({ sweet: 1, woody: 1 }),
        specs: { proof: 120 },
      }),
      candidate({
        id: "plain",
        traitVector: vec({ sweet: 1, woody: 1 }),
        specs: { proof: 80 },
      }),
    ];
    const out = recommendForType({
      type: "bourbon",
      tasteVector,
      signals: warmSignals,
      candidates,
      exclude: new Set(),
      preferences: prefs,
    });
    expect(out[0]?.candidate.id).toBe("pref-match");
    expect(out[0]?.matchesPreferences).toBe(true);
  });

  it("respects the limit", () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      candidate({ id: `c${i}`, traitVector: vec({ sweet: 1, woody: 1 }) }),
    );
    const out = recommendForType({
      type: "bourbon",
      tasteVector,
      signals: warmSignals,
      candidates,
      exclude: new Set(),
      preferences: EMPTY_PREFERENCES,
      limit: 2,
    });
    expect(out).toHaveLength(2);
  });
});

describe("recommendForType — cold start (preferences only)", () => {
  it("falls back to preference matches when the taste vector is thin", () => {
    const prefs: MemberPreferences = {
      ...EMPTY_PREFERENCES,
      bourbon_proof_bands: ["high"],
    };
    const candidates = [
      candidate({ id: "pref", traitVector: vec({ earthy: 1 }), specs: { proof: 120 } }),
      candidate({ id: "no-pref", traitVector: vec({ sweet: 1 }), specs: { proof: 80 } }),
    ];
    const out = recommendForType({
      type: "bourbon",
      tasteVector: null,
      signals: [],
      candidates,
      exclude: new Set(),
      preferences: prefs,
    });
    expect(out.map((s) => s.candidate.id)).toEqual(["pref"]);
    expect(out[0]?.coldStart).toBe(true);
  });

  it("recommends nothing with neither signal nor preferences", () => {
    const candidates = [
      candidate({ id: "x", traitVector: vec({ sweet: 1 }), specs: { proof: 90 } }),
    ];
    const out = recommendForType({
      type: "bourbon",
      tasteVector: null,
      signals: [],
      candidates,
      exclude: new Set(),
      preferences: EMPTY_PREFERENCES,
    });
    expect(out).toEqual([]);
  });

  it("treats a single tried as cold start (below threshold)", () => {
    const prefs: MemberPreferences = { ...EMPTY_PREFERENCES, bourbon_proof_bands: ["high"] };
    const thinSignals: TasteSignal[] = [{ traitVector: vec({ sweet: 1 }), loved: false }];
    const candidates = [
      candidate({ id: "pref", traitVector: vec({ earthy: 1 }), specs: { proof: 120 } }),
      candidate({ id: "similar", traitVector: vec({ sweet: 1 }), specs: { proof: 80 } }),
    ];
    const out = recommendForType({
      type: "bourbon",
      tasteVector: vec({ sweet: 1 }),
      signals: thinSignals,
      candidates,
      exclude: new Set(),
      preferences: prefs,
    });
    // Cold start: preference match wins despite the similar non-match.
    expect(out.map((s) => s.candidate.id)).toEqual(["pref"]);
    expect(out[0]?.coldStart).toBe(true);
  });
});
