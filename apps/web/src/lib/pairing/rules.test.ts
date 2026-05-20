import { describe, expect, it } from "vitest";
import { PAIRING_TRAITS, type TraitVector } from "@/lib/wheel";
import { evaluatePairing, PAIRING_RULES } from "./rules";

/**
 * Build a trait vector with named overrides; everything else is zero.
 */
function tv(overrides: Partial<TraitVector>): TraitVector {
  const result = {} as TraitVector;
  for (const t of PAIRING_TRAITS) result[t] = overrides[t] ?? 0;
  return result;
}

describe("pairing rules — individual firings", () => {
  it("sweet-earth-balance fires when cigar leans earthy/dry and bourbon leans sweet/creamy", () => {
    const cigar = tv({ earthy: 0.3, dry: 0.2 });
    const bourbon = tv({ sweet: 0.3, creamy: 0.2 });
    const reasons = evaluatePairing(cigar, bourbon);
    expect(reasons.find((r) => r.rule === "sweet-earth-balance")).toBeDefined();
  });

  it("sweet-earth-balance does NOT fire when cigar has no earthy or dry signal", () => {
    const cigar = tv({ sweet: 0.4 });
    const bourbon = tv({ sweet: 0.5, creamy: 0.5 });
    const reasons = evaluatePairing(cigar, bourbon);
    expect(reasons.find((r) => r.rule === "sweet-earth-balance")).toBeUndefined();
  });

  it("roasted-harmony fires when both sides are roasted", () => {
    const reasons = evaluatePairing(tv({ roasted: 0.3 }), tv({ roasted: 0.25 }));
    expect(reasons.find((r) => r.rule === "roasted-harmony")).toBeDefined();
  });

  it("warm-harmony fires when both sides are warm-spiced", () => {
    const reasons = evaluatePairing(tv({ warm: 0.2 }), tv({ warm: 0.25 }));
    expect(reasons.find((r) => r.rule === "warm-harmony")).toBeDefined();
  });

  it("woody-harmony fires on shared wood", () => {
    const reasons = evaluatePairing(tv({ woody: 0.25 }), tv({ woody: 0.2 }));
    expect(reasons.find((r) => r.rule === "woody-harmony")).toBeDefined();
  });

  it("bright-lift fires when cigar is heavily earthy and bourbon brings brightness", () => {
    const reasons = evaluatePairing(tv({ earthy: 0.4 }), tv({ bright: 0.2 }));
    expect(reasons.find((r) => r.rule === "bright-lift")).toBeDefined();
  });

  it("bright-lift does not fire if the cigar is only moderately earthy", () => {
    const reasons = evaluatePairing(tv({ earthy: 0.2 }), tv({ bright: 0.5 }));
    expect(reasons.find((r) => r.rule === "bright-lift")).toBeUndefined();
  });

  it("sharp-clash fires (negative contribution) when both sides are very sharp", () => {
    const reasons = evaluatePairing(tv({ sharp: 0.4 }), tv({ sharp: 0.5 }));
    const clash = reasons.find((r) => r.rule === "sharp-clash");
    expect(clash).toBeDefined();
    expect(clash?.contribution).toBeLessThan(0);
  });

  it("sharp-clash stays dormant when only one side is sharp", () => {
    const reasons = evaluatePairing(tv({ sharp: 0.5 }), tv({ sweet: 0.5 }));
    expect(reasons.find((r) => r.rule === "sharp-clash")).toBeUndefined();
  });

  it("cloying-sweet fires (negative) when both sides are very sweet", () => {
    const reasons = evaluatePairing(tv({ sweet: 0.5 }), tv({ sweet: 0.4 }));
    const cloying = reasons.find((r) => r.rule === "cloying-sweet");
    expect(cloying).toBeDefined();
    expect(cloying?.contribution).toBeLessThan(0);
  });

  it("fruity-counterpoint fires when cigar is dry and bourbon is fruity", () => {
    const reasons = evaluatePairing(tv({ dry: 0.2 }), tv({ fruity: 0.2 }));
    expect(reasons.find((r) => r.rule === "fruity-counterpoint")).toBeDefined();
  });
});

describe("pairing rules — composition", () => {
  it("returns an empty list when no rule fires (both vectors near zero)", () => {
    expect(evaluatePairing(tv({}), tv({}))).toEqual([]);
  });

  it("the canonical 'cocoa+leather cigar with vanilla wheater' pair fires multiple positive rules", () => {
    const cigar = tv({ earthy: 0.3, dry: 0.25, sweet: 0.15 });
    const bourbon = tv({ sweet: 0.35, creamy: 0.3, woody: 0.15 });
    const reasons = evaluatePairing(cigar, bourbon);
    const rules = new Set(reasons.map((r) => r.rule));
    expect(rules.has("sweet-earth-balance")).toBe(true);
    // Net contribution should be solidly positive.
    const total = reasons.reduce((s, r) => s + r.contribution, 0);
    expect(total).toBeGreaterThan(10);
  });

  it("a high-rye cigar with a high-rye bourbon hits the sharp-clash penalty", () => {
    const cigar = tv({ sharp: 0.4, earthy: 0.2 });
    const bourbon = tv({ sharp: 0.5 });
    const reasons = evaluatePairing(cigar, bourbon);
    expect(reasons.some((r) => r.rule === "sharp-clash")).toBe(true);
    const total = reasons.reduce((s, r) => s + r.contribution, 0);
    expect(total).toBeLessThan(0);
  });

  it("rule contributions are deterministic — same input, same output", () => {
    const cigar = tv({ earthy: 0.3, dry: 0.25 });
    const bourbon = tv({ sweet: 0.3, creamy: 0.25, woody: 0.2 });
    const first = evaluatePairing(cigar, bourbon);
    const second = evaluatePairing(cigar, bourbon);
    expect(first).toEqual(second);
  });

  it("returns rules in declaration order (stable for snapshot rendering)", () => {
    // Engineer a vector that fires all of: sweet-earth, roasted, warm.
    const cigar = tv({ earthy: 0.3, dry: 0.2, roasted: 0.2, warm: 0.2 });
    const bourbon = tv({ sweet: 0.3, creamy: 0.2, roasted: 0.2, warm: 0.2 });
    const reasons = evaluatePairing(cigar, bourbon);
    const order = reasons.map((r) => r.rule);
    expect(order.indexOf("sweet-earth-balance")).toBeLessThan(order.indexOf("roasted-harmony"));
    expect(order.indexOf("roasted-harmony")).toBeLessThan(order.indexOf("warm-harmony"));
  });
});

describe("PAIRING_RULES catalog", () => {
  it("exposes at least 6 rules", () => {
    expect(PAIRING_RULES.length).toBeGreaterThanOrEqual(6);
  });

  it("each rule has a unique name", () => {
    const cigar = tv({
      earthy: 0.5,
      dry: 0.5,
      sweet: 0.5,
      creamy: 0.5,
      warm: 0.5,
      sharp: 0.5,
      woody: 0.5,
      roasted: 0.5,
      bright: 0.5,
      fruity: 0.5,
    });
    const bourbon = cigar;
    const reasons = evaluatePairing(cigar, bourbon);
    const names = reasons.map((r) => r.rule);
    expect(new Set(names).size).toBe(names.length);
  });
});
