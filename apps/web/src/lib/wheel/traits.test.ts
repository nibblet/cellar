import { describe, expect, it } from "vitest";
import { rollUpTraits } from "./traits";
import { PAIRING_TRAITS, type WheelVector } from "./types";

describe("rollUpTraits", () => {
  it("returns zero for every trait when the wheel vector is empty", () => {
    const result = rollUpTraits("cigar", {});
    for (const trait of PAIRING_TRAITS) {
      expect(result[trait]).toBe(0);
    }
  });

  it("returns values in the 0..1 range for any input", () => {
    const vector: WheelVector = {
      cocoa: 5,
      leather: 5,
      "black-pepper": 5,
      cedar: 5,
      coffee: 5,
    };
    const result = rollUpTraits("cigar", vector);
    for (const trait of PAIRING_TRAITS) {
      expect(result[trait]).toBeGreaterThanOrEqual(0);
      expect(result[trait]).toBeLessThanOrEqual(1);
    }
  });

  it("clamps out-of-range scores defensively", () => {
    const normalized = rollUpTraits("cigar", { cocoa: 5 }); // legal max
    const clampedHigh = rollUpTraits("cigar", { cocoa: 99 }); // illegally high
    expect(clampedHigh.sweet).toBeCloseTo(normalized.sweet, 6);
  });

  it("ignores scores below 1 (zero-suppression)", () => {
    const withZero = rollUpTraits("cigar", { cocoa: 0 });
    for (const trait of PAIRING_TRAITS) {
      expect(withZero[trait]).toBe(0);
    }
  });

  it("ignores unknown leaf ids gracefully", () => {
    const result = rollUpTraits("cigar", { "made-up-leaf": 5, cocoa: 5 });
    // sweet trait should still register from cocoa
    expect(result.sweet).toBeGreaterThan(0);
  });

  it("an earthy+dry cigar profile maxes both traits when all carriers fire", () => {
    // Cigar wheel: leather, hay carry both earthy and dry; soil carries earthy; tobacco carries
    // earthy+dry; musk carries earthy; mineral carries dry; tea carries dry; walnut carries
    // dry+roasted. Firing everything earthy/dry at 5 should push both close to 1.0.
    const vector: WheelVector = {
      leather: 5,
      hay: 5,
      soil: 5,
      musk: 5,
      tobacco: 5,
      mineral: 5,
      tea: 5,
      walnut: 5,
    };
    const result = rollUpTraits("cigar", vector);
    expect(result.earthy).toBeGreaterThan(0.5);
    expect(result.dry).toBeGreaterThan(0.5);
  });

  it("a sweet+creamy bourbon profile lights up matching traits", () => {
    const vector: WheelVector = {
      vanilla: 5,
      caramel: 5,
      butterscotch: 5,
      toffee: 5,
      honey: 5,
    };
    const result = rollUpTraits("bourbon", vector);
    expect(result.sweet).toBeGreaterThan(0.3);
    expect(result.creamy).toBeGreaterThan(0.3);
    // Should not be flooding traits it has no business activating.
    expect(result.sharp).toBe(0);
    expect(result.earthy).toBe(0);
  });
});
