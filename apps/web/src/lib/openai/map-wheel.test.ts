import { describe, expect, it } from "vitest";
import { fallbackMapFromChips } from "./map-wheel";

describe("fallbackMapFromChips", () => {
  it("maps cigar chips directly onto leaves at score 4", () => {
    const result = fallbackMapFromChips("cigar", ["cocoa", "leather", "pepper"]);
    expect(result.cocoa).toBe(4);
    expect(result.leather).toBe(4);
    // "pepper" without modifier → black-pepper via synonym
    expect(result["black-pepper"] ?? result["white-pepper"]).toBeDefined();
  });

  it("honors synonyms via the wheel JSON", () => {
    const result = fallbackMapFromChips("cigar", ["barnyard", "espresso"]);
    expect(result.hay).toBe(4);
    expect(result.coffee).toBe(4);
  });

  it("ignores chips that don't map to any leaf", () => {
    const result = fallbackMapFromChips("cigar", ["elderflower", "cocoa"]);
    expect(result.elderflower).toBeUndefined();
    expect(result.cocoa).toBe(4);
  });

  it("returns empty object for no recognizable chips", () => {
    expect(fallbackMapFromChips("cigar", [])).toEqual({});
    expect(fallbackMapFromChips("cigar", ["nonsense"])).toEqual({});
  });

  it("works for bourbon wheel", () => {
    const result = fallbackMapFromChips("bourbon", ["vanilla", "caramel", "demerara"]);
    expect(result.vanilla).toBe(4);
    expect(result.caramel).toBe(4);
    expect(result["brown-sugar"]).toBe(4);
  });

  it("normalizes case and whitespace", () => {
    const result = fallbackMapFromChips("bourbon", ["  Vanilla  ", "CARAMEL"]);
    expect(result.vanilla).toBe(4);
    expect(result.caramel).toBe(4);
  });
});
