import { describe, expect, it } from "vitest";
import { DISAMBIGUATION_SCORE_GAP } from "./resolve-product";

describe("resolveProductByQuery constants", () => {
  it("uses a small gap for disambiguation", () => {
    expect(DISAMBIGUATION_SCORE_GAP).toBe(0.05);
  });
});

describe("resolveProductByQuery ranking logic", () => {
  it("treats close scores as ambiguous", () => {
    const top = 0.82;
    const second = 0.79;
    expect(top - second).toBeLessThan(DISAMBIGUATION_SCORE_GAP);
  });

  it("treats separated scores as unambiguous", () => {
    const top = 0.9;
    const second = 0.7;
    expect(top - second).toBeGreaterThanOrEqual(DISAMBIGUATION_SCORE_GAP);
  });
});
